import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { checkRateLimit, RATE_LIMIT_DEGRADED_ERROR, RATE_LIMIT_ERROR } from "@/lib/rate-limit";
import { toCsv } from "@/lib/surveys/export";
import { writeWorkbook } from "@/lib/surveys/export-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  format: z.enum(["csv", "xlsx"]).default("csv"),
  comments: z.array(z.record(z.string(), z.unknown())).min(1).max(10000),
  metadata: z.record(z.string(), z.unknown()).optional(),
  anonymize: z.boolean().default(true),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await checkRateLimit({
    namespace: "netnokit:export",
    key: user.id,
    limit: 10,
    window: "10 m",
    onDegraded: "closed",
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: limit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR },
      { status: limit.degraded ? 503 : 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { format, comments, metadata } = parsed.data;

  const NETNO_COLUMNS = [
    "Comment_ID", "Parent_ID", "Thread_Root_ID", "Depth", "Author_ID", "Author_Username",
    "Author_Display_Name", "Created_At_UTC", "Updated_At_UTC", "Like_Count", "Reply_Count",
    "Is_Deleted", "Permalink", "Raw_Text", "Cleaned_Text",
  ];

  const rows: string[][] = [NETNO_COLUMNS];
  for (const c of comments) {
    rows.push([
      String(c.commentId ?? ""),
      c.parentId ? String(c.parentId) : "",
      String(c.threadRootId ?? ""),
      String(c.depth ?? 0),
      String(c.authorId ?? ""),
      c.authorUsername ? String(c.authorUsername) : "",
      c.authorDisplayName ? String(c.authorDisplayName) : "",
      String(c.createdAt ?? ""),
      c.updatedAt ? String(c.updatedAt) : "",
      String(c.likeCount ?? 0),
      String(c.replyCount ?? 0),
      c.isDeleted ? "true" : "false",
      c.permalink ? String(c.permalink) : "",
      String(c.text ?? ""),
      String(c.cleanedText ?? ""),
    ]);
  }

  const metaRows: string[][] = [
    ["Field", "Value"],
    ...Object.entries(metadata ?? {}).map(([k, v]) => [k, String(v ?? "")]),
  ];

  if (format === "csv") {
    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="netnokit_export.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const workbook = new (await import("exceljs")).default.Workbook();
  const dataSheet = workbook.addWorksheet("Comments");
  dataSheet.addRow(NETNO_COLUMNS);
  for (const r of rows.slice(1)) dataSheet.addRow(r);
  const metaSheet = workbook.addWorksheet("Study_Metadata");
  for (const r of metaRows) metaSheet.addRow(r);

  const buffer = await writeWorkbook(workbook);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="netnokit_export.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
