import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/db";
import { isUserAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import {
  buildCodebook,
  buildRawData,
  toCsv,
  type ExportSurvey,
} from "@/lib/surveys/export";

export const dynamic = "force-dynamic";

/**
 * Research export endpoint. Owner-or-admin only; serves either a two-sheet
 * XLSX workbook (Codebook + Raw Data) or a flat CSV for R/Python/Stata/SPSS.
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
  if (survey.authorId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const responses = await prisma.surveyResponse.findMany({
    where: { surveyId: id },
    select: {
      id: true,
      createdAt: true,
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
    const csv = toCsv(buildRawData(exportSurvey, responses, includeIdentity));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}_data.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const codebookSheet = XLSX.utils.aoa_to_sheet(buildCodebook(exportSurvey));
  codebookSheet["!cols"] = [{ wch: 16 }, { wch: 60 }, { wch: 18 }, { wch: 10 }, { wch: 50 }, { wch: 60 }];
  const rawDataSheet = XLSX.utils.aoa_to_sheet(
    buildRawData(exportSurvey, responses, includeIdentity),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, codebookSheet, "Codebook");
  XLSX.utils.book_append_sheet(workbook, rawDataSheet, "Raw Data");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBase}_export.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
