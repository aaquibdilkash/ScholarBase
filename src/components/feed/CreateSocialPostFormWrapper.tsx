"use client";

import { useAuthModal } from "@/components/interactions/AuthModal";
import { useFormDraft } from "@/hooks/useFormDraft";
import { CreateSocialPostForm } from "./CreateSocialPostForm";

export function CreateSocialPostFormWrapper({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  return <CreateSocialPostForm />;
}