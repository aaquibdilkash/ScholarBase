import { NextResponse } from "next/server";
import { adminDeleteContent, adminDeleteComment } from "@/app/actions/admin";

export async function POST(request: Request) {
  try {
    const { contentType, contentId, commentType, commentId } = await request.json();

    if (commentType && commentId) {
      await adminDeleteComment(commentType, commentId);
    } else if (contentType && contentId) {
      await adminDeleteContent(contentType, contentId);
    } else {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete:", error);
    return NextResponse.json(
      { error: "Failed to delete content" },
      { status: 500 }
    );
  }
}