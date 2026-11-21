// Notification producers historically stored the actor prefix in the title
// and body. Resolve that prefix at display time from the current profile.
const ACTOR_MARKERS = [
  " posted", " published", " shared", " added", " created", " started",
  " commented", " replied", " tagged", " mentioned", " upvoted", " followed",
  " participated",
];

/** Index of the first actor marker, or undefined when the text has no prefix. */
function actorMarkerIndex(text: string) {
  return ACTOR_MARKERS
    .map((marker) => text.indexOf(marker))
    .filter((index) => index > 0)
    .sort((a, b) => a - b)[0];
}

/**
 * Rollup suffix stored in a clustered title, e.g. " and 2 others". Display-time
 * canonicalization swaps the leading name but must keep this suffix, otherwise
 * "Ada and 2 others commented" collapses back to "Ada commented".
 */
const ROLLUP_SUFFIX = /\s+and\s+\d+\s+others?(?=\s|$)/;

export function canonicalizeActorPrefix(text: string, actorName: string) {
  const markerIndex = actorMarkerIndex(text);
  if (markerIndex === undefined) return text;

  const rollup = text.slice(0, markerIndex).match(ROLLUP_SUFFIX)?.[0] ?? "";
  return `${actorName}${rollup}${text.slice(markerIndex)}`;
}

/**
 * Clustered title, mirroring `formatRollupBody` in the notification worker:
 * "Ada and 2 others commented on your post".
 *
 * `othersCount` is the number of earlier distinct actors, so a row with
 * `count: 3` renders "2 others". Titles without an actor prefix (the generic
 * "New Upvote") are returned unchanged — their rollup copy lives in the body.
 */
export function formatRollupTitle(
  title: string,
  actorName: string,
  othersCount: number,
) {
  const markerIndex = actorMarkerIndex(title);
  if (markerIndex === undefined) return title;

  const suffix = othersCount === 1 ? "1 other" : `${othersCount} others`;
  return `${actorName} and ${suffix}${title.slice(markerIndex)}`;
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
