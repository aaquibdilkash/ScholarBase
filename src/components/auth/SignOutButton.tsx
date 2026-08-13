"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

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

  const handleSignOut = async () => {
    setIsSigningOut(true);

    const { error } = await createClient().auth.signOut();
    if (error) {
      setIsSigningOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      {...props}
      type="button"
      disabled={disabled || isSigningOut}
      onClick={handleSignOut}
    >
      {isSigningOut ? "Signing out..." : children}
    </button>
  );
}
