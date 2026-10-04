"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/utils/supabase/client";
import { PRESENCE_TOPIC, privateChannel } from "@/lib/realtime";
import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { useIsFrozen } from "./FrozenUserProvider";

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
  const isFrozen = useIsFrozen();
  // Held in a ref because `privateChannel` resolves asynchronously, while the
  // visibilitychange/online handlers below need the channel immediately.
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => setUser(user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user || isFrozen) {
      setOnlineUserIds(new Set());
      return;
    }

    // ⚡ The channel is joined asynchronously because `privateChannel` awaits
    // `realtime.setAuth()` first. Presence state is authorization-relevant, so a
    // public channel here would leak who is online to any anon-key holder.
    const syncPresence = () => {
      const state = channelRef.current?.presenceState() as
        | PresenceState
        | undefined;
      if (!state) return;
      setOnlineUserIds(new Set(Object.keys(state)));
    };

    const trackOnline = () => {
      channelRef.current
        ?.track({ online_at: new Date().toISOString() })
        .catch(() => {});
    };

    let cancelled = false;

    void privateChannel(PRESENCE_TOPIC, { presence: { key: user.id } }).then(
      (channel) => {
        if (cancelled) {
          void supabase.removeChannel(channel);
          return;
        }
        channelRef.current = channel;

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
      },
    );

    const handleVisibilityChange = () => {
      if (!document.hidden) trackOnline();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", trackOnline);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", trackOnline);
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setOnlineUserIds(new Set());
    };
  }, [user, isFrozen]);

  return (
    <PresenceContext.Provider
      value={{ onlineUserIds, currentUserId: user?.id ?? null }}
    >
      {children}
    </PresenceContext.Provider>
  );
}
