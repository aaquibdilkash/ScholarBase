"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type User = {
  id: string;
  email?: string | null;
  isAdmin?: boolean | null;
} | null;

export function useUser() {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
          });
        }
      } catch (error) {
        console.error("Failed to load user:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}
