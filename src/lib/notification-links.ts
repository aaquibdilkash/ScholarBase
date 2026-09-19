import { Notification } from "@prisma/client";

const targetLinks: Record<string, (targetId: string) => string | null> = {
  article: (targetId) => `/blog/${targetId}`,
  post: (targetId) => `/feed/${targetId}`,
  socialPost: (targetId) => `/feed/${targetId}`,
  event: (targetId) => `/events/${targetId}`,
  vacancy: (targetId) => `/vacancies/${targetId}`,
  admission: (targetId) => `/admissions/${targetId}`,
  recommendation: (targetId) => {
    const recIds = targetId.split("/");
    return recIds.length === 2
      ? `/supervisor/${recIds[0]}/recommendation/${recIds[1]}`
      : null;
  },
  journalReview: (targetId) => {
    const reviewIds = targetId.split("/");
    return reviewIds.length === 2
      ? `/journals/${reviewIds[0]}/review/${reviewIds[1]}`
      : null;
  },
  help: (targetId) => `/help/${targetId}`,
  journal: (targetId) => `/journals/${targetId}`,
  researchTool: (targetId) => `/research-tools/${targetId}`,
  researchGrant: (targetId) => `/grants/${targetId}`,
  course: (targetId) => `/learn/${targetId}`,
  result: (targetId) => `/results/${targetId}`,
  contribution: (targetId) => `/contributions/${targetId}`,
  publication: (targetId) => `/publications/${targetId}`,
  survey: (targetId) => `/surveys/${targetId}`,
  supervisor: (targetId) => `/supervisor/${targetId}`,
  // Scholar (user) profile — used by admin moderation notifications so a
  // frozen/deleted/recovered user lands on their own profile page.
  profile: (targetId) => `/scholars/${targetId}`,
};

const moduleLabels: Record<string, string> = {
  article: "Blog",
  post: "Feed",
  socialPost: "Feed",
  event: "Events",
  vacancy: "Vacancies",
  admission: "Admissions",
  recommendation: "Supervisor recommendation",
  journalReview: "Journal review",
  help: "Help",
  journal: "Journals",
  researchTool: "Research Tools",
  researchGrant: "Research Grants",
  course: "Courses",
  result: "Results",
  contribution: "Contributions",
  publication: "Publications",
  survey: "Research Survey",
};

const targetTypeAliases: Record<string, string> = {
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

  const targetType = normalizeTargetType(notification.targetType);

  switch (notification.type) {
    case "follow":
    case "NEW_FOLLOWER":
      return `/scholars/${notification.actorId}`;
    case "post-mention":
      // Post mention: link directly to the post (not comments)
      return targetLinks[targetType]?.(notification.targetId) ?? null;
    case "mention":
      // Comment mention: link to the entity page scrolled to comments
      return targetLinks[targetType]?.(notification.targetId)?.concat("#comments") ?? null;
    case "NEW_COMMENT":
    case "NEW_REPLY":
      return targetLinks[targetType]?.(notification.targetId)?.concat("#comments") ?? null;
    case "message-received":
      return `/messages/${notification.targetId}`;
    default:
      return targetLinks[targetType]?.(notification.targetId) ?? null;
  }
}

export function getModuleLabel(targetType: string): string {
  return moduleLabels[targetType] || targetType;
}
