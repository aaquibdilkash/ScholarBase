/**
 * Language options for a course.
 *
 * A closed list keeps the value filterable and consistent. It covers the major
 * Indian languages plus the most common international ones; extend the array to
 * add another, no schema change needed.
 */
export const COURSE_LANGUAGES = [
  "Arabic",
  "Assamese",
  "Bengali",
  "Chinese",
  "Dutch",
  "English",
  "French",
  "German",
  "Gujarati",
  "Hindi",
  "Indonesian",
  "Italian",
  "Japanese",
  "Kannada",
  "Korean",
  "Malayalam",
  "Marathi",
  "Odia",
  "Persian",
  "Polish",
  "Portuguese",
  "Punjabi",
  "Russian",
  "Sanskrit",
  "Spanish",
  "Swahili",
  "Tamil",
  "Telugu",
  "Thai",
  "Turkish",
  "Urdu",
  "Vietnamese",
  "Other",
] as const;

export type CourseLanguage = (typeof COURSE_LANGUAGES)[number];

const COURSE_LANGUAGE_SET = new Set<string>(COURSE_LANGUAGES);

export function isCourseLanguage(value: string): value is CourseLanguage {
  return COURSE_LANGUAGE_SET.has(value);
}
