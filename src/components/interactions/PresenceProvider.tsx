"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * ⚡ Centralized Presence Channel (Issue 3)
 *
 * A single global presence channel (`presence:global`) owned by the root
 * provider tree instead of per-chat-window channels that get created and
 * destroyed as conversations switch. Presence stays reliable across
 * conversation changes, tab sleeps and socket reconnects:
 *  - re-tracks on `visibilitychange` (tab returns from background)
 *  - re-tracks on `online` (device regains connectivity)
 *  - re-tracks whenever the channel reports SUBSCRIBED again
 */

type PresenceState = {
  [userId: string]: Array<{ online_at?: string }>;
};

interface PresenceContextValue {
  onlineUserIds: Set<string>;
  currentUserId: string | null;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUserIds: new Set<string>(),
  currentUserId: null,
});

export function usePresence() {
  return useContext(PresenceContext);
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => setUser(user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("presence:global", {
      config: { presence: { key: user.id } },
    });

    const syncPresence = () => {
      const state = channel.presenceState() as PresenceState;
      setOnlineUserIds(new Set(Object.keys(state)));
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, ({ key }: { key: string }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel
            .track({ online_at: new Date().toISOString() })
            .catch(() => {});
          syncPresence();
        }
      });

    // Re-sync presence when the tab wakes up or connectivity returns.
    const trackOnline = () => {
      channel
        .track({ online_at: new Date().toISOString() })
        .catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) trackOnline();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", trackOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", trackOnline);
      supabase.removeChannel(channel);
      setOnlineUserIds(new Set());
    };
  }, [user]);

  return (
    <PresenceContext.Provider
      value={{ onlineUserIds, currentUserId: user?.id ?? null }}
    >
      {children}
    </PresenceContext.Provider>
  );
}
