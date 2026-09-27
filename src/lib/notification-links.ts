import { Notification } from "@prisma/client";

/**
 * Everything we know about a notification target, in ONE registry.
 *
 * This file used to hold three parallel records keyed on the same target-type
 * strings — `targetLinks`, `moduleLabels` and `targetTypeAliases` — and making a
 * vote notification say what was voted on then needed a fourth (a singular
 * "noun") for its copy. Each addition was another list to keep in step, and a
 * target could be linkable but unlabelled (supervisor, profile) or labelled but
 * with no copy. One entry per target, three fields, no parallel maps.
 *
 * `targetTypeAliases` is the one map that stays separate, because its job is
 * different: it folds every spelling a stored `targetType` may use onto a
 * canonical key. It is typed against the registry's keys, so an alias pointing
 * at a target that does not exist is a compile error rather than a dead link
 * found in production.
 */
type TargetDef = {
  /** Where the target lives, given the id stored on the notification. */
  link: (targetId: string) => string | null;
  /** Section heading: the admin reports table and the digest email group on it. */
  label: string;
  /** Singular noun for notification copy: "upvoted your <noun>". */
  noun: string;
};

/**
 * Reviews and recommendations are nested under a parent (a journal, a
 * supervisor), so their notification target id is the composite
 * `parentId/childId`. A bare child id resolves to nothing rather than to a URL
 * that 404s.
 */
const nested = (build: (parentId: string, childId: string) => string) =>
  (targetId: string) => {
    const [parentId, childId] = targetId.split("/");
    return parentId && childId ? build(parentId, childId) : null;
  };

const TARGETS = {
  article: { link: (t: string) => `/blog/${t}`, label: "Blog", noun: "blog post" },
  post: { link: (t: string) => `/feed/${t}`, label: "Feed", noun: "post" },
  socialPost: { link: (t: string) => `/feed/${t}`, label: "Feed", noun: "post" },
  event: { link: (t: string) => `/events/${t}`, label: "Events", noun: "event" },
  vacancy: { link: (t: string) => `/vacancies/${t}`, label: "Vacancies", noun: "vacancy" },
  admission: { link: (t: string) => `/admissions/${t}`, label: "Admissions", noun: "admission" },
  recommendation: {
    link: nested((p, c) => `/supervisor/${p}/recommendation/${c}`),
    label: "Supervisor recommendation",
    noun: "recommendation",
  },
  journalReview: {
    link: nested((p, c) => `/journals/${p}/review/${c}`),
    label: "Journal review",
    noun: "journal review",
  },
  help: { link: (t: string) => `/help/${t}`, label: "Help", noun: "help post" },
  journal: { link: (t: string) => `/journals/${t}`, label: "Journals", noun: "journal" },
  researchTool: { link: (t: string) => `/research-tools/${t}`, label: "Research Tools", noun: "research tool" },
  researchGrant: { link: (t: string) => `/grants/${t}`, label: "Research Grants", noun: "research grant" },
  course: { link: (t: string) => `/learn/${t}`, label: "Courses", noun: "course" },
  result: { link: (t: string) => `/results/${t}`, label: "Results", noun: "result" },
  contribution: { link: (t: string) => `/contributions/${t}`, label: "Contributions", noun: "contribution" },
  publication: { link: (t: string) => `/publications/${t}`, label: "Publications", noun: "publication" },
  survey: { link: (t: string) => `/surveys/${t}`, label: "Research Survey", noun: "survey" },
  supervisor: { link: (t: string) => `/supervisor/${t}`, label: "Supervisor", noun: "supervisor" },
  // Scholar profile — used by admin moderation notifications so a frozen,
  // deleted or recovered user lands on their own profile page.
  profile: { link: (t: string) => `/scholars/${t}`, label: "Scholar", noun: "scholar" },
} satisfies Record<string, TargetDef>;

type CanonicalTarget = keyof typeof TARGETS;

/** Registry lookup by canonical key. */
function targetFor(key: string): TargetDef | undefined {
  return (TARGETS as Record<string, TargetDef>)[key];
}

/** Every spelling a stored `targetType` may use, folded onto a registry key. */
const targetTypeAliases: Record<string, CanonicalTarget> = {
  article: "article",
  post: "post",
  socialpost: "socialPost",
  event: "event",
  researchevent: "event",
  vacancy: "vacancy",
  jobvacancy: "vacancy",
  admission: "admission",
  phdadmission: "admission",
  recommendation: "recommendation",
  journalreview: "journalReview",
  help: "help",
  helppost: "help",
  journal: "journal",
  researchtool: "researchTool",
  researchgrant: "researchGrant",
  course: "course",
  result: "result",
  contribution: "contribution",
  publication: "publication",
  survey: "survey",
  researchsurvey: "survey",
  supervisor: "supervisor",
  profile: "profile",
};

function normalizeTargetType(targetType: string) {
  return targetTypeAliases[targetType.toLowerCase()] ?? targetType;
}

export function getNotificationLink(notification: Notification) {
  if (!notification.targetType || !notification.targetId) {
    return null;
  }

  const target = targetFor(normalizeTargetType(notification.targetType));
  const pathFor = (targetId: string) => target?.link(targetId) ?? null;

  switch (notification.type) {
    case "follow":
    case "NEW_FOLLOWER":
      return `/scholars/${notification.actorId}`;
    case "post-mention":
      // Post mention: link directly to the post (not comments)
      return pathFor(notification.targetId);
    case "mention":
      // Comment mention: link to the entity page scrolled to comments
      return pathFor(notification.targetId)?.concat("#comments") ?? null;
    case "NEW_COMMENT":
    case "NEW_REPLY":
      return pathFor(notification.targetId)?.concat("#comments") ?? null;
    case "message-received":
      return `/messages/${notification.targetId}`;
    default:
      return pathFor(notification.targetId);
  }
}

/**
 * Section heading for a target, e.g. "Journals" or "Journal review".
 *
 * Deliberately NOT normalized: the admin reports table passes a report's coarse
 * `contentType` ("POST" / "COMMENT"), which has no registry entry and must keep
 * rendering verbatim instead of silently resolving to some other section.
 */
export function getModuleLabel(targetType: string): string {
  return targetFor(targetType)?.label ?? targetType;
}

/**
 * Singular noun for notification copy, e.g. "upvoted your journal review".
 *
 * `label` is deliberately not reused here — it is a section heading ("Journals",
 * "Admissions"), which would read "upvoted your journals". An unknown or
 * missing target type falls back to "post", the wording this copy used before
 * it was module-aware.
 */
export function getModuleNoun(targetType?: string | null): string {
  if (!targetType) return "post";
  return targetFor(normalizeTargetType(targetType))?.noun ?? "post";
}
