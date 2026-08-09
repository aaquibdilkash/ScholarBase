"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getScholars } from "@/app/actions/scholars";
import {
  startConversation,
  findDirectConversation,
} from "@/app/actions/messages";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useFormSubmit } from "@/hooks/useFormSubmit";

type Scholar = Awaited<ReturnType<typeof getScholars>>[0];
type Recipient = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
};

export function NewMessageForm({
  initialRecipient,
}: {
  initialRecipient: Recipient | null;
}) {
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();
  const { openAuthModal } = useAuthModal();
  const { submitting, submit } = useFormSubmit(undefined, {
    successMessage: "Message sent successfully!",
    resetOnSuccess: false,
  });

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Scholar[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(
    initialRecipient,
  );
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (search.length > 2) {
      setIsSearching(true);
      const debounce = setTimeout(() => {
        getScholars(search).then((users) => {
          setSearchResults(users);
          setIsSearching(false);
        });
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      setSearchResults([]);
    }
  }, [search]);

  const handleSelectRecipient = async (recipient: Recipient) => {
    if (user) {
      const conversationId = await findDirectConversation(
        user.id,
        recipient.id,
      );
      if (conversationId) {
        router.push(`/messages/${conversationId}`);
        return;
      }
    }
    setSelectedRecipient(recipient);
    setSearch("");
    setSearchResults([]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }
    const formData = new FormData(event.currentTarget);
    if (!selectedRecipient) {
      toast("Please select a recipient.", "error");
      return;
    }
    await submit(() => startConversation(formData));
  };

  return (
    <form onSubmit={handleSubmit} className="sb-card space-y-5 p-6 md:p-8">
      <div className="space-y-2">
        <label className="sb-label" htmlFor="recipientId">
          Recipient
        </label>
        {selectedRecipient ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-950 dark:bg-slate-800">
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white dark:text-slate-300">
                {selectedRecipient.name?.charAt(0).toUpperCase() ||
                  selectedRecipient.handle?.charAt(0).toUpperCase() ||
                  "@"}
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedRecipient.name}
              </div>
              {selectedRecipient.handle && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  @{selectedRecipient.handle}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedRecipient(null)}
              className="ml-auto text-xs text-slate-500 hover:text-red-500"
            >
              Change
            </button>
            <input
              type="hidden"
              id="recipientId"
              name="recipientId"
              value={selectedRecipient.id}
            />
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sb-input"
              placeholder="Search for a scholar by name or handle..."
            />
            {isSearching && (
              <p className="p-4 text-sm text-slate-500">Searching...</p>
            )}
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white shadow-lg dark:bg-slate-900 dark:shadow-slate-950">
                <ul className="py-1">
                  {searchResults.map((user) => (
                    <li
                      key={user.id}
                      onClick={() => handleSelectRecipient(user)}
                      className="cursor-pointer px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {user.name} (@{user.handle})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <label className="sb-label" htmlFor="body">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          className="sb-textarea min-h-40"
          placeholder="Introduce yourself and explain the collaboration idea."
          required
        />
      </div>
      <button type="submit" className="sb-button-primary" disabled={submitting}>
        {submitting ? "Sending..." : "Start conversation"}
      </button>
    </form>
  );
}
