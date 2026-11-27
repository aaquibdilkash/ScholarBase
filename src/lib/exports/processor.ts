import "server-only";

import prisma from "@/lib/db";
import { isUserAdmin } from "@/lib/auth";
import { redactRespondentIdentity } from "@/lib/surveys/export";
import { buildWorkbook, writeWorkbook } from "@/lib/surveys/export-xlsx";

import { markExportJobDone, markExportJobFailed, markExportJobRunning, getExportJob } from "@/lib/exports/job";
import { exportObjectPath, uploadExportObject, deleteExportObject } from "@/lib/exports/storage";

const SURVEY_EXPORT_PAGE_SIZE = 500;

async function runSurveyExport(jobId: string) {
  const job = await getExportJob(jobId);
  if (!job) throw new Error("Job not found");
  const params = (job.params ?? {}) as Record<string, unknown>;
  const surveyId = String(params.surveyId ?? "");
  const format = params.format === "csv" ? "csv" : "xlsx";
  const userId = job.userId;
  const anonymizeForced = params.anonymize === true;

  if (!surveyId) throw new Error("surveyId required");

  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: {
      title: true,
      privacy: true,
      authorId: true,
      shareData: true,
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!survey) throw new Error("Survey not found");

  const isAdmin = await isUserAdmin(userId);
  const isOwner = survey.authorId === userId;
  const authorized = isOwner || isAdmin;
  if (!authorized && !survey.shareData) throw new Error("Forbidden");

  const anonymize = !authorized || anonymizeForced;
  const forceAnonymous = survey.privacy === "ANONYMOUS";

  const exportSurvey = {
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
      matrixMode: q.matrixMode as "SINGLE" | "MULTIPLE" | undefined,
      options: q.options.map((o) => ({ value: o.value, label: o.label, order: o.order })),
    })),
  };

  const safeResponses: unknown[] = [];
  let cursor: string | undefined;
  while (true) {
    const page = await prisma.surveyResponse.findMany({
      where: { surveyId },
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
      orderBy: { id: "asc" },
      take: SURVEY_EXPORT_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    for (const response of page) {
      safeResponses.push(redactRespondentIdentity(response as never, forceAnonymous));
    }
    cursor = page[page.length - 1].id;
    if (page.length < SURVEY_EXPORT_PAGE_SIZE) break;
  }

  const includeIdentity =
    survey.privacy !== "ANONYMOUS" &&
    (safeResponses as { isAnonymous: boolean }[]).some((r) => !r.isAnonymous);

  const ext = format === "csv" ? "csv" : "xlsx";
  const objectPath = exportObjectPath(userId, jobId, ext);

  if (format === "csv") {
    const { toCsv, buildRawData } = await import("@/lib/surveys/export");
    const rows = buildRawData(exportSurvey as never, safeResponses as never, includeIdentity, anonymize);
    const csv = toCsv(rows);
    const buf = Buffer.from(csv, "utf8");
    const up = await uploadExportObject(objectPath, buf, "text/csv; charset=utf-8");
    if (up.error) throw new Error(up.error);
  } else {
    const workbook = buildWorkbook(exportSurvey as never, safeResponses as never, includeIdentity, anonymize);
    const buffer = await writeWorkbook(workbook);
    const up = await uploadExportObject(objectPath, new Uint8Array(buffer), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    if (up.error) throw new Error(up.error);
  }

  await markExportJobDone(jobId, objectPath);
}

export async function processExportJob(jobId: string): Promise<void> {
  await markExportJobRunning(jobId);
  try {
    const job = await getExportJob(jobId);
    if (!job) throw new Error("Job not found");
    if (job.kind === "SURVEY") {
      await runSurveyExport(jobId);
    } else {
      throw new Error(`Unsupported job kind: ${job.kind}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    const job = await getExportJob(jobId);
    if (job?.objectPath) await deleteExportObject(job.objectPath);
    await markExportJobFailed(jobId, msg);
    throw e;
  }
}
