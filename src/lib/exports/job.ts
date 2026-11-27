import "server-only";

import prisma from "@/lib/db";
import type { ExportJobKind, ExportJobStatus } from "@prisma/client";

export type ExportJobRecord = {
  id: string;
  userId: string;
  kind: ExportJobKind;
  params: unknown;
  status: ExportJobStatus;
  objectPath: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

export async function createExportJob(
  userId: string,
  kind: ExportJobKind,
  params: unknown,
): Promise<ExportJobRecord> {
  return prisma.exportJob.create({
    data: { userId, kind, params: params as object, status: "QUEUED" },
  }) as Promise<ExportJobRecord>;
}

export async function getExportJob(id: string): Promise<ExportJobRecord | null> {
  return prisma.exportJob.findUnique({ where: { id } }) as Promise<ExportJobRecord | null>;
}

export async function markExportJobRunning(id: string): Promise<void> {
  await prisma.exportJob.update({
    where: { id },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export async function markExportJobDone(id: string, objectPath: string): Promise<void> {
  await prisma.exportJob.update({
    where: { id },
    data: { status: "DONE", objectPath, completedAt: new Date() },
  });
}

export async function markExportJobFailed(id: string, error: string): Promise<void> {
  await prisma.exportJob.update({
    where: { id },
    data: { status: "FAILED", error: error.slice(0, 500), completedAt: new Date() },
  });
}
