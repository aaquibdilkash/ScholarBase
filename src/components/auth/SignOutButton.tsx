"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

type SignOutButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "onClick"
> & {
  children: ReactNode;
};

/**
 * Signs out through the browser client so every `onAuthStateChange` listener
 * receives SIGNED_OUT before the app navigates away.
 */
export default function SignOutButton({
  children,
  disabled,
  ...props
}: SignOutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const confirmSignOut = async () => {
    setIsSigningOut(true);

    const { error } = await createClient().auth.signOut();
    if (error) {
      setIsSigningOut(false);
      return;
    }

    setIsModalOpen(false);
    router.replace("/login");
    router.refresh();
  };

  return (
    <>
      <button
        {...props}
        type="button"
        disabled={disabled || isSigningOut}
        onClick={() => setIsModalOpen(true)}
      >
        {isSigningOut ? "Signing out..." : children}
      </button>
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmSignOut}
        title="Confirm Sign Out"
        message="Are you sure you want to sign out? You will be redirected to the login page."
        isConfirming={isSigningOut}
        confirmLabel="Sign Out"
        confirmingLabel="Signing out..."
        confirmVariant="outline"
      />
    </>
  );
}
