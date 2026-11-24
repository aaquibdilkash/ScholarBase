"use client";

import { useEffect, useState } from "react";
import { createGroupConversation } from "@/app/actions/messages";
import { useScholarSearch } from "@/hooks/useScholarSearch";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { MAX_GROUP_NAME, MAX_GROUP_PARTICIPANTS } from "@/constants/messages";
import { ScholarSuggestionDropdown } from "@/components/interactions/ScholarSuggestionDropdown";
import { MIN_SEARCH_LENGTH } from "@/lib/search-guard";
import { TextField } from "@/components/ui/TextField";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { X } from "lucide-react";

type Member = { id: string; name: string | null; handle: string | null; avatarUrl: string | null };
const GROUP_DRAFT_KEY = "sb_new_group_draft";

function readDraft(): { title: string; members: Member[] } | null {
  try {
    const raw = window.localStorage.getItem(GROUP_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<{ title: string; members: Member[] }>;
    return {
      title: typeof draft.title === "string" ? draft.title : "",
      members: Array.isArray(draft.members) ? draft.members : [],
    };
  } catch {
    return null;
  }
}

export function NewGroupForm({ contextType, contextId, initialTitle }: { contextType?: string; contextId?: string; initialTitle?: string }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const { results, isSearching } = useScholarSearch(search, 8);
  const clearDraft = () => {
    try {
      window.localStorage.removeItem(GROUP_DRAFT_KEY);
    } catch {
      // Draft persistence is best-effort; it must never block group creation.
    }
  };
  const { submitting, submit } = useFormSubmit(clearDraft, {
    successMessage: "Group created. Invitations sent!",
    onSuccess: (result) => {
      const conversationId = result.data && typeof result.data === "object" && "id" in result.data
        ? result.data.id
        : undefined;
      if (conversationId) {
        window.dispatchEvent(new CustomEvent("conversation-created", {
          detail: { conversationId },
        }));
      }
    },
  });

  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setTitle(draft.title);
      setMembers(draft.members);
    } else if (initialTitle) {
      setTitle(initialTitle);
    }
  }, [initialTitle]);

  useEffect(() => {
    if (!title && members.length === 0) return;
    try {
      window.localStorage.setItem(GROUP_DRAFT_KEY, JSON.stringify({ title, members }));
    } catch {
      // Draft persistence is best-effort; it must never block typing.
    }
  }, [title, members]);

  const addMember = (member: Member) => {
    if (member.id === user?.id) {
      toast("You are already included in the group.", "error");
      return;
    }
    if (members.some((item) => item.id === member.id)) {
      toast("This scholar is already selected.", "error");
      return;
    }
    if (members.length >= MAX_GROUP_PARTICIPANTS - 1) {
      toast(`A group can have up to ${MAX_GROUP_PARTICIPANTS} participants.`, "error");
      return;
    }
    setMembers((current) => [...current, member]);
    setSearch("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await submit(() => createGroupConversation(formData));
  };

  return (
    <form onSubmit={handleSubmit} className="sb-surface-strong flex flex-col gap-5 p-4 sm:p-6 md:p-10">
      <TextField
        id="title"
        name="title"
        label="Group name"
        tip={`Shown at the top of the conversation and in every member's inbox. ${MAX_GROUP_NAME} characters maximum.`}
        maxLength={MAX_GROUP_NAME}
        className="sb-input"
        placeholder="e.g. Paper 3 review squad"
        value={title}
        onValueChange={setTitle}
        required
      />
      <div>
        <label className="sb-label inline-flex items-center gap-1.5" htmlFor="memberSearch">
          Participants
          <InfoTooltip message="Invitations are sent right away. A scholar joins the group after accepting, and the group holds up to eight participants including you." />
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {members.map((member) => (
            <span key={member.id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-1 pl-3 pr-1.5 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              {member.name || member.handle || "Scholar"}
              <button
                type="button"
                onClick={() => setMembers((current) => current.filter((item) => item.id !== member.id))}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-blue-200 dark:hover:bg-blue-900"
                aria-label={`Remove ${member.name || member.handle || "scholar"}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        {/* `relative` anchors the absolutely-positioned suggestion list to this
            input. Without it the dropdown sized itself against a distant
            ancestor and spilled outside the card. */}
        <div className="relative">
          <input
            id="memberSearch"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sb-input"
            placeholder="Search scholars to invite…"
            autoComplete="off"
          />
          <ScholarSuggestionDropdown
            suggestions={results}
            loading={isSearching}
            loadingMessage="Searching scholars…"
            onSelect={addMember}
            emptyMessage={search.trim().length >= MIN_SEARCH_LENGTH ? "No matching scholars." : undefined}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          You are included automatically. {members.length + 1}/{MAX_GROUP_PARTICIPANTS} seats reserved, pending invites included.
        </p>
      </div>
      {contextType && contextId && <><input type="hidden" name="contextType" value={contextType} /><input type="hidden" name="contextId" value={contextId} /></>}
      {members.map((member) => <input key={member.id} type="hidden" name="memberIds" value={member.id} />)}
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <FormCancelButton href="/messages" />
        <button type="submit" className="sb-button-primary" disabled={submitting}>{submitting ? "Creating..." : "Create group"}</button>
      </div>
    </form>
  );
}
