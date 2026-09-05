/**
 * Centralized display-title accessor for admin/moderation table rows.
 * Content models use wildly different naming for their "title" field
 * (ResearchTool.toolName, HelpPost.subject, ResearchSurvey.question, ...),
 * so every table cell and export goes through this single resolver instead
 * of scattering `item.title || item.name || "Untitled"` fallbacks.
 */
export function getEntityDisplayTitle(item: Record<string, unknown>): string {
  const candidate =
    (item.title as string | null | undefined) ||
    (item.name as string | null | undefined) ||
    (item.toolName as string | null | undefined) ||
    (item.subject as string | null | undefined) ||
    (item.grantName as string | null | undefined) ||
    (item.question as string | null | undefined) ||
    (item.headline as string | null | undefined);

  if (candidate && candidate.trim().length > 0) return candidate;

  const university = item.university as string | null | undefined;
  const department = item.department as string | null | undefined;
  const universityDepartment = university || department;
  if (universityDepartment && universityDepartment.trim().length > 0) {
    const parts = [university, department].filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );
    return parts.join(" — ");
  }

  const content = item.content as string | null | undefined;
  if (content && content.trim().length > 0) {
    const trimmed = content.trim().slice(0, 40);
    return content.trim().length > 40 ? `${trimmed}...` : trimmed;
  }

  const supervisor = item.supervisor as { name?: string } | null | undefined;
  const supervisorName = supervisor?.name;
  if (supervisorName && supervisorName.trim().length > 0) {
    return supervisorName.trim();
  }

  // Appeal rows carry no entity title — show the appeal text instead.
  const appealReason = item.appealReason as string | null | undefined;
  if (appealReason && appealReason.trim().length > 0) {
    const trimmed = appealReason.trim().slice(0, 40);
    return appealReason.trim().length > 40 ? `${trimmed}...` : trimmed;
  }

  return "Untitled";
}