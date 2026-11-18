"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db";
import { getActiveUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue } from "@/lib/form";
import { getBaseUrl } from "@/lib/url";
import { getManuscriptPermissions } from "@/lib/publishing/access";
import { buildAuthorList } from "@/lib/publishing/citations";
import { MANUSCRIPT_BUCKET } from "@/lib/publishing/constants";
import { buildDoiMetadata } from "@/lib/publishing/doi-metadata";
import { canEditorSetStatus } from "@/lib/publishing/permissions";
import {
  createZenodoDeposit,
  getZenodoDeposit,
  isZenodoConfigured,
  publishZenodoDeposit,
  setZenodoMetadata,
  uploadZenodoFile,
  ZenodoError,
  zenodoFileName,
  type ZenodoDeposit,
} from "@/lib/publishing/zenodo";
import { notifyUserById } from "@/lib/notifications";
import { createServiceClient } from "@/utils/supabase/service";

/**
 * Mint a DOI for a published article through Zenodo.
 *
 * Publication and registration are separate acts: the article page and its
 * citation downloads work the day a paper is published, and a DOI is added
 * afterwards once the editor has checked the record. That ordering also means a
 * Zenodo outage can never block an issue going live.
 *
 * Idempotency is the hard requirement. Zenodo happily creates duplicate
 * deposits, so this action:
 *
 * 1. refuses when `Manuscript.doi` is already set;
 * 2. writes `doiStatus = PENDING` *before* the first outbound request;
 * 3. persists `zenodoDepositId` the moment Zenodo returns one; and
 * 4. on retry, resumes that deposit instead of creating another.
 *
 * A crash between (2) and (3) leaves a PENDING row with a stale `updatedAt`;
 * the claim below lets a run older than two minutes resume it. A duplicate
 * deposit is therefore impossible to cause with the button, only by deleting
 * the stored deposit id by hand.
 *
 * Zenodo DOIs resolve to the Zenodo record. The deposit metadata links back to
 * the article page, but a Zenodo DOI cannot land on this domain — that needs a
 * Crossref/DataCite membership.
 */

export type DoiActionResult = {
  success: boolean;
  message: string;
};

/** How long a PENDING row without a fresh update is treated as abandoned. */
const STALE_PENDING_MS = 2 * 60 * 1000;

function fail(message: string): DoiActionResult {
  return { success: false, message };
}

export async function mintDoiAction(
  _previous: DoiActionResult,
  formData: FormData,
): Promise<DoiActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:doi",
    key: auth.user.id,
    limit: 10,
    window: "1 h",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const manuscriptId = readFormValue(formData, "manuscriptId");
  if (!manuscriptId) return fail("Choose a manuscript first.");

  const manuscript = await prisma.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      title: true,
      abstract: true,
      keywords: true,
      coAuthors: true,
      status: true,
      round: true,
      authorId: true,
      venueId: true,
      doi: true,
      doiStatus: true,
      zenodoDepositId: true,
      publishedAt: true,
      volume: true,
      issue: true,
      firstPage: true,
      lastPage: true,
      isbn: true,
      author: { select: { name: true, orcidUrl: true } },
      venue: {
        select: {
          name: true,
          slug: true,
          type: true,
          issn: true,
          eissn: true,
          publisherName: true,
          licenseUrl: true,
        },
      },
      files: {
        where: { kind: "MANUSCRIPT" },
        orderBy: [{ round: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { filePath: true, fileName: true },
      },
    },
  });
  if (!manuscript) return fail("That manuscript no longer exists.");

  if (manuscript.status !== "PUBLISHED") {
    return fail("Only a published article can receive a DOI.");
  }

  const permissions = await getManuscriptPermissions(auth.user.id, manuscript);
  const actor = { roles: permissions.roles, isAdmin: permissions.isAdmin };
  if (!canEditorSetStatus(actor, "PUBLISHED")) {
    return fail("Only the Editor-in-Chief can mint a DOI.");
  }

  if (manuscript.doi) {
    // Repair a row whose DOI was recorded but whose status was not (an older
    // manual backfill), rather than sending a second deposit.
    if (manuscript.doiStatus !== "MINTED") {
      await prisma.manuscript.update({
        where: { id: manuscript.id },
        data: { doiStatus: "MINTED" },
      });
    }
    return {
      success: true,
      message: `This article already has DOI ${manuscript.doi}.`,
    };
  }

  if (!isZenodoConfigured()) {
    return fail(
      "DOI minting is not configured yet. Add ZENODO_TOKEN to the environment, then try again.",
    );
  }

  const authors = buildAuthorList(
    { name: manuscript.author.name, orcidUrl: manuscript.author.orcidUrl },
    manuscript.coAuthors,
  );
  if (authors.length === 0) {
    return fail("Add at least one author byline before minting a DOI.");
  }

  const file = manuscript.files[0];
  if (!file) {
    return fail("Attach the PDF version of record before minting a DOI.");
  }

  // Read the bytes before claiming the row: a missing bucket or service key
  // must fail with a useful message, not leave a PENDING deposit behind.
  let pdf: ArrayBuffer;
  try {
    const download = await createServiceClient()
      .storage.from(MANUSCRIPT_BUCKET)
      .download(file.filePath);

    if (download.error || !download.data) {
      return fail("The PDF for this article could not be read. Check the files panel.");
    }

    pdf = await download.data.arrayBuffer();
  } catch {
    return fail("The PDF for this article could not be read. Check the files panel.");
  }

  if (pdf.byteLength === 0) {
    return fail("The stored PDF is empty. Upload the version of record again.");
  }

  // Claim the mint. A fresh PENDING row is another editor's in-flight request;
  // a stale one is a crashed run and is safe to resume because the deposit id
  // (when one exists) is reused below.
  const staleBefore = new Date(Date.now() - STALE_PENDING_MS);
  const claim = await prisma.manuscript.updateMany({
    where: {
      id: manuscript.id,
      status: "PUBLISHED",
      doi: null,
      OR: [
        { doiStatus: { in: ["NONE", "FAILED"] } },
        { doiStatus: "PENDING", updatedAt: { lt: staleBefore } },
      ],
    },
    data: { doiStatus: "PENDING" },
  });

  if (claim.count === 0) {
    const fresh = await prisma.manuscript.findUnique({
      where: { id: manuscript.id },
      select: { doi: true },
    });
    if (fresh?.doi) {
      return { success: true, message: `This article already has DOI ${fresh.doi}.` };
    }
    return fail(
      "A DOI mint is already in progress for this article. Retry in a few minutes.",
    );
  }

  const prefix = manuscript.venue.type === "JOURNAL" ? "sbj" : "sbc";

  try {
    const baseUrl = await getBaseUrl();
    const articleUrl = `${baseUrl}/${prefix}/${manuscript.venue.slug}/article/${manuscript.id}`;

    let depositId = manuscript.zenodoDepositId;
    let deposit: ZenodoDeposit | null = null;
    let doi: string | null = null;

    if (depositId) {
      deposit = await getZenodoDeposit(depositId);
      // A previous run may have published and crashed before recording the DOI.
      if (deposit.submitted) {
        if (!deposit.doi) {
          throw new ZenodoError(
            "Zenodo reports this deposit as published but returned no DOI.",
          );
        }
        doi = deposit.doi;
      }
    }

    if (!doi) {
      if (!deposit) {
        deposit = await createZenodoDeposit();
        // Persist immediately: from here on, every retry resumes this deposit.
        await prisma.manuscript.update({
          where: { id: manuscript.id },
          data: { zenodoDepositId: deposit.id },
        });
      }

      const fileName = zenodoFileName(file.fileName, manuscript.id);
      if (!deposit.fileNames.includes(fileName)) {
        if (!deposit.bucketUrl) {
          throw new ZenodoError("Zenodo did not return an upload bucket.");
        }
        await uploadZenodoFile(deposit.bucketUrl, fileName, pdf);
      }

      await setZenodoMetadata(
        deposit.id,
        buildDoiMetadata({
          article: manuscript,
          authors,
          venue: manuscript.venue,
          articleUrl,
        }),
      );

      let published = await publishZenodoDeposit(deposit.id);
      if (!published.doi) published = await getZenodoDeposit(deposit.id);
      doi = published.doi;
      depositId = deposit.id;
    }

    if (!doi || !depositId) {
      throw new ZenodoError("Zenodo published the record but returned no DOI.");
    }

    await prisma.manuscript.update({
      where: { id: manuscript.id },
      data: {
        doi,
        doiStatus: "MINTED",
        zenodoDepositId: depositId,
      },
    });

    revalidatePath("/workspace/editorial");
    revalidatePath("/workspace/editorial/board");
    revalidatePath(`/workspace/editorial/manuscripts/${manuscript.id}`);
    revalidatePath(`/workspace/submissions/${manuscript.id}`);
    revalidatePath(`/${prefix}/${manuscript.venue.slug}`);
    revalidatePath(`/${prefix}/${manuscript.venue.slug}/article/${manuscript.id}`);

    await notifyUserById({
      recipientId: manuscript.authorId,
      actorId: auth.user.id,
      type: "manuscript-doi",
      targetType: "manuscript",
      targetId: manuscript.id,
      title: `DOI registered for ${manuscript.title}`,
      body: `${manuscript.venue.name} registered ${doi} for this article.`,
    });

    return {
      success: true,
      message: `Minted ${doi}. The DOI resolves to the Zenodo record for this article.`,
    };
  } catch (error) {
    // A published Zenodo record is kept: the next run sees `submitted`, reads
    // its DOI, and only then writes `MINTED`.
    await prisma.manuscript
      .updateMany({
        where: { id: manuscript.id, doiStatus: "PENDING" },
        data: { doiStatus: "FAILED" },
      })
      .catch(() => undefined);

    const detail =
      error instanceof Error &&
      (error.name === "ZenodoError" || error.name === "DoiMetadataError")
        ? error.message
        : "Zenodo could not be reached. Try again in a few minutes.";

    return fail(`DOI minting failed. ${detail}`);
  }
}
