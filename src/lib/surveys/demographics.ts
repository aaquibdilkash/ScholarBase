import type { Question } from "@/types/survey";

/**
 * Pre-validated demographic question templates formatted to international
 * research standards (ISCED 2011 education levels, UNESCO age bands).
 * One click inserts the block into the survey builder.
 */

export const DEMOGRAPHIC_BLOCKS: Array<{
  key: string;
  label: string;
  description: string;
  questions: Array<Omit<Question, "id" | "order">>;
}> = [
  {
    key: "age",
    label: "Age",
    description: "UNESCO-standard age bands",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "What is your age group?",
        required: false,
        minValue: null,
        maxValue: null,
        options: [
          { value: "age_18_24", label: "18–24", order: 0 },
          { value: "age_25_34", label: "25–34", order: 1 },
          { value: "age_35_44", label: "35–44", order: 2 },
          { value: "age_45_54", label: "45–54", order: 3 },
          { value: "age_55_64", label: "55–64", order: 4 },
          { value: "age_65_plus", label: "65 or older", order: 5 },
          { value: "prefer_not_say", label: "Prefer not to say", order: 6 },
        ],
      },
    ],
  },
  {
    key: "gender",
    label: "Gender",
    description: "Inclusive categories with self-describe",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "What is your gender?",
        required: false,
        minValue: null,
        maxValue: null,
        options: [
          { value: "woman", label: "Woman", order: 0 },
          { value: "man", label: "Man", order: 1 },
          { value: "non_binary", label: "Non-binary", order: 2 },
          { value: "self_describe", label: "Prefer to self-describe", order: 3 },
          { value: "prefer_not_say", label: "Prefer not to say", order: 4 },
        ],
      },
    ],
  },
  {
    key: "education",
    label: "Education",
    description: "ISCED 2011 levels",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "What is the highest level of education you have completed?",
        required: false,
        minValue: null,
        maxValue: null,
        options: [
          { value: "isced_2", label: "Secondary school (ISCED 2–3)", order: 0 },
          { value: "isced_4", label: "Post-secondary non-tertiary (ISCED 4)", order: 1 },
          { value: "isced_5", label: "Short-cycle tertiary (ISCED 5)", order: 2 },
          { value: "isced_6", label: "Bachelor's or equivalent (ISCED 6)", order: 3 },
          { value: "isced_7", label: "Master's or equivalent (ISCED 7)", order: 4 },
          { value: "isced_8", label: "Doctoral or equivalent (ISCED 8)", order: 5 },
          { value: "prefer_not_say", label: "Prefer not to say", order: 6 },
        ],
      },
    ],
  },
  {
    key: "field",
    label: "Research Field",
    description: "Broad academic discipline areas",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "Which broad field best describes your research area?",
        required: false,
        minValue: null,
        maxValue: null,
        options: [
          { value: "natural_sciences", label: "Natural Sciences", order: 0 },
          { value: "engineering_tech", label: "Engineering & Technology", order: 1 },
          { value: "medical_health", label: "Medical & Health Sciences", order: 2 },
          { value: "agricultural", label: "Agricultural Sciences", order: 3 },
          { value: "social_sciences", label: "Social Sciences", order: 4 },
          { value: "humanities", label: "Humanities", order: 5 },
          { value: "interdisciplinary", label: "Interdisciplinary", order: 6 },
        ],
      },
    ],
  },
  {
    key: "career_stage",
    label: "Career Stage",
    description: "Standard academic career stages",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "What is your current career stage?",
        required: false,
        minValue: null,
        maxValue: null,
        options: [
          { value: "undergrad", label: "Undergraduate student", order: 0 },
          { value: "masters", label: "Master's student", order: 1 },
          { value: "phd", label: "PhD candidate / doctoral researcher", order: 2 },
          { value: "postdoc", label: "Postdoctoral researcher", order: 3 },
          { value: "faculty", label: "Faculty / academic staff", order: 4 },
          { value: "industry", label: "Industry researcher", order: 5 },
          { value: "other", label: "Other", order: 6 },
        ],
      },
    ],
  },
];
