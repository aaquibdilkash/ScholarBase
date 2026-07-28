import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const post = await prisma.socialPost.findUnique({
        where: { id },
        select: {
            id: true,
            content: true,
            imageUrls: true,
            authorId: true,
        },
    });

    if (!post) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (post.authorId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
        content: post.content,
        imageUrls: post.imageUrls,
    });
}

