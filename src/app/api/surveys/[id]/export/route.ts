import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isUserAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import {
  buildRawData,
  toCsv,
  type ExportSurvey,
} from "@/lib/surveys/export";
import { buildWorkbook, writeWorkbook } from "@/lib/surveys/export-xlsx";

export const dynamic = "force-dynamic";

/**
 * Research export endpoint.
 * - Owner / admin: full access (identity columns included if survey is non-anonymous).
 * - Other authenticated users: allowed only when survey.shareData is true; results
 *   are force-anonymized (all respondent identity columns stripped).
 * Serves either a two-sheet XLSX workbook (Codebook + Raw Data) or a flat CSV.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const survey = await prisma.researchSurvey.findUnique({
    where: { id, isDeleted: false },
    select: {
      title: true,
      privacy: true,
      authorId: true,
      shareData: true,
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!survey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = await isUserAdmin(user.id);
  const isOwner = survey.authorId === user.id;
  const isAuthorized = isOwner || isAdmin;

  // Non-owners can download only when the survey creator enabled data sharing.
  // Their export is force-anonymized (no respondent handles/names).
  const shareData = survey.shareData ?? false;
  if (!isAuthorized && !shareData) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const anonymize = !isAuthorized;

  const responses = await prisma.surveyResponse.findMany({
    where: { surveyId: id },
    select: {
      id: true,
      createdAt: true,
      editedAt: true,
      startedAt: true,
      completedAt: true,
      consentedAt: true,
      isAnonymous: true,
      respondent: { select: { name: true, handle: true } },
      answers: { select: { questionId: true, value: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const exportSurvey: ExportSurvey = {
    title: survey.title,
    privacy: survey.privacy,
    questions: survey.questions.map((q) => ({
      id: q.id,
      type: q.type,
      title: q.title,
      required: q.required,
      order: q.order,
      minValue: q.minValue,
      maxValue: q.maxValue,
      archivedAt: q.archivedAt,
      shuffleOptions: q.shuffleOptions,
      skipLogic: q.skipLogic,
      columnLabels: q.columnLabels,
      options: q.options.map((o) => ({
        value: o.value,
        label: o.label,
        order: o.order,
      })),
    })),
  };

  // Identity columns are stripped for anonymous surveys at the source.
  const includeIdentity =
    survey.privacy !== "ANONYMOUS" &&
    responses.some((r) => !r.isAnonymous);

  const format = new URL(request.url).searchParams.get("format") ?? "xlsx";
  const fileBase =
    survey.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "survey";

  if (format === "csv") {
    const csv = toCsv(buildRawData(exportSurvey, responses, includeIdentity, anonymize));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}_data.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Two-sheet workbook: a Codebook data dictionary plus the flat Raw Data
  // matrix. `writeWorkbook` awaits exceljs's zip serialization, which is why
  // this handler stays async end to end.
  const workbook = buildWorkbook(
    exportSurvey,
    responses,
    includeIdentity,
    anonymize,
  );
  const buffer = await writeWorkbook(workbook);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBase}_export.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
