export const SURVEY_SHARE_ORIGIN = "https://scholarbase.app";

/** URL encoded into survey QR codes and share actions. */
export function getSurveyShareUrl(
  surveyId: string,
  baseUrl: string = SURVEY_SHARE_ORIGIN,
): string {
  return `${baseUrl.replace(/\/+$/, "")}/surveys/${encodeURIComponent(surveyId)}`;
}
