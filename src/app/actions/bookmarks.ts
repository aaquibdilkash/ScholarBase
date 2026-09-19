"use server";

import { getActiveUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/rate-limit";
import {
  handleBookmarkTransaction,
  type ModuleKey,
} from "@/lib/transactions";

export async function toggleBookmark(entityId: string, module: ModuleKey) {
  const auth = await getActiveUser("You must be logged in to bookmark content.");
  if (auth.frozen) {
    return {
      success: false,
      error:
        "Your account is frozen. You are restricted from bookmarking content.",
    };
  }
  const user = auth.user;

  if (!entityId || !module) {
    throw new Error("Missing required parameters for bookmarking.");
  }

  const rateLimit = await checkRateLimit({
    namespace: `bookmark:${module}`,
    key: user.id,
    limit: 120,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  try {
    const { totalBookmarks, isBookmarked } = await handleBookmarkTransaction(
      module,
      entityId,
      user.id,
    );

    return { success: true, data: { totalBookmarks, isBookmarked } };
  } catch (error) {
    console.error(`Error bookmarking ${module} (${entityId}):`, error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
