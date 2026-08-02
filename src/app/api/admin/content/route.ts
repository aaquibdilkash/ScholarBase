import { NextResponse } from "next/server";
import { getAdminContent } from "@/app/actions/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const content = await getAdminContent(type || undefined);
    
    return NextResponse.json(content);
  } catch (error) {
    console.error("Failed to fetch admin content:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}