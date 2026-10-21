// Notification producers historically stored the actor prefix in the title
// and body. Resolve that prefix at display time from the current profile.
export function canonicalizeActorPrefix(text: string, actorName: string) {
  const markers = [
    " posted", " published", " shared", " added", " created", " started",
    " commented", " replied", " tagged", " mentioned", " upvoted", " followed",
  ];
  const markerIndex = markers
    .map((marker) => text.indexOf(marker))
    .filter((index) => index > 0)
    .sort((a, b) => a - b)[0];

  return markerIndex === undefined ? text : `${actorName}${text.slice(markerIndex)}`;
}

export function formatPublishedContentTitle(
  title: string,
  actorName: string,
  targetType: string | null,
) {
  const target = targetType?.toLowerCase() ?? "";
  if (target === "article" && title.includes(" published")) {
    return `${actorName} published a new blog`;
  }
  if ((target === "post" || target === "socialpost") && title.includes(" ")) {
    return `${actorName} posted a research update`;
  }
  return canonicalizeActorPrefix(title, actorName);
}
