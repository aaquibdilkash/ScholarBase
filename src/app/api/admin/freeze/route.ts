import { NextResponse } from "next/server";
import { toggleContentFreeze, toggleAuthorFreeze } from "@/app/actions/admin";

export async function POST(request: Request) {
  try {
    const { contentType, contentId, authorId } = await request.json();

    let result;
    if (authorId) {
      result = await toggleAuthorFreeze(authorId);
    } else if (contentType && contentId) {
      result = await toggleContentFreeze(contentType, contentId);
    } else {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to toggle freeze:", error);
    return NextResponse.json(
      { error: "Failed to update freeze status" },
      { status: 500 }
    );
  }
}