"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type User = {
  id: string;
  email?: string | null;
  isAdmin?: boolean | null;
  user_metadata: { [key: string]: any };
} | null;

export function useUser() {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
