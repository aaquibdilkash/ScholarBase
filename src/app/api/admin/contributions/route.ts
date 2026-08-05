import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isUserAdmin } from "@/lib/auth";
import prisma from "@/lib/db";
import { notifyUserById } from "@/lib/notifications";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isUserAdmin(user.id))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { contentId, status, reason } = await req.json();

  if (!contentId || !status) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  if (status === "REJECTED" && !reason) {
    return new NextResponse("Missing reason for rejection", { status: 400 });
  }

  try {
    const updatedContribution = await prisma.contribution.update({
      where: { id: contentId },
      data: {
        status,
        ...(status === "REJECTED" && { rejectionReason: reason }),
      },
      include: {
        author: {
          select: {
            id: true,
          },
        },
      },
    });

    if (status === "APPROVED") {
      await notifyUserById({
        recipientId: updatedContribution.author.id,
        actorId: user.id,
        type: "contribution-approved",
        targetType: "contribution",
        targetId: updatedContribution.id,
        title: "Your contribution has been approved!",
        body: `Your contribution "${updatedContribution.title}" has been approved.`,
      });
    } else if (status === "REJECTED") {
      await notifyUserById({
        recipientId: updatedContribution.author.id,
        actorId: user.id,
        type: "contribution-rejected",
        targetType: "contribution",
        targetId: updatedContribution.id,
        title: "Your contribution has been rejected",
        body: `Your contribution "${updatedContribution.title}" has been rejected. Reason: ${reason}`,
      });
    }

    return NextResponse.json(updatedContribution);
  } catch (error) {
    console.error("Failed to update contribution status:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
