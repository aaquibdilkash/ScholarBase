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

export function getNotificationLink(notification: Notification) {
  if (!notification.targetType || !notification.targetId) {
    return null;
  }

  const targetType = notification.targetType.toLowerCase();

  switch (notification.type) {
    case "follow":
      return `/scholars/${notification.actorId}`;
    case "post-mention":
      // Post mention: link directly to the post (not comments)
      return targetLinks[targetType]?.(notification.targetId) ?? null;
    case "mention":
      // Comment mention: link to the entity page scrolled to comments
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
