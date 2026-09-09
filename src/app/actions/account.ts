"use server";

import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

type DeleteAccountResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function deleteAccount(
  formData: FormData,
): Promise<DeleteAccountResult> {
  const user = await requireActiveUser(
    "You must be logged in to delete your account.",
  );
  const confirmation = formData.get("confirmation");

  if (confirmation !== "DELETE") {
    return {
      success: false,
      error: 'Type "DELETE" exactly to confirm account deletion.',
    };
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: {
        id: user.id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        isFrozen: true,
        institutionEmail: null,
        institutionDomain: null,
        institutionVerifiedAt: null,
        pendingInstitutionEmail: null,
        pendingInstitutionDomain: null,
        institutionVerificationTokenHash: null,
        institutionVerificationExpiresAt: null,
      },
    });

    return result.count === 1;
  });

  if (!deleted) {
    return { success: false, error: "This account is already deleted." };
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  return {
    success: true,
    message: "Your account has been deleted.",
  };
}
