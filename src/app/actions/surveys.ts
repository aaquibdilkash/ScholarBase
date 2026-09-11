"use server";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { Prisma, SurveyQuestionType } from "@prisma/client";
import type { SurveyQuestionInput } from "@/types/survey";
import { getCurrentUser, requireActiveUser, isAuthorizedOrAdmin, isUserAdmin } from "@/lib/auth";
import {
  checkRateLimit,
  enforceRateLimit,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";
import { readFormValue, readOptionalFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { COMMENT_PAGE_SIZE, MAX_SURVEY_DESCRIPTION, MAX_SURVEY_CONSENT_TEXT, MAX_SURVEY_BLOCKS, MAX_MATRIX_COLUMNS, MAX_SURVEY_QUESTION_OPTION, MAX_SURVEY_QUESTION_TITLE } from "@/lib/constants";
import { parseSkipLogic, computeSkippedQuestionIds } from "@/lib/surveys/logic";
import type { SurveyBlockInput } from "@/types/survey";

const MAX_RESPONSE_DURATION_MS = 24 * 60 * 60 * 1000;

/** Clamp a client-supplied consent statement before persisting. */
function sanitizeConsentText(raw: FormDataEntryValue | null): string | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  return text ? text.slice(0, MAX_SURVEY_CONSENT_TEXT) : null;
}

/** Parse + validate the block list submitted by the builder. */
function parseBlockInputs(json: string | null): SurveyBlockInput[] {
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid blocks payload.");
  }
  if (!Array.isArray(parsed)) throw new Error("Invalid blocks payload.");
  if (parsed.length > MAX_SURVEY_BLOCKS) {
    throw new Error(`A survey may have at most ${MAX_SURVEY_BLOCKS} blocks.`);
  }
  return parsed.map((block, i) => {
    const b = block as SurveyBlockInput;
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title) throw new Error("Block title is required.");
    return {
      id: typeof b.id === "string" && b.id ? b.id : undefined,
      title: title.slice(0, MAX_SURVEY_QUESTION_TITLE),
      order: Number.isInteger(b.order) ? b.order : i,
      randomizeOrder: b.randomizeOrder === true,
    };
  });
}

function sanitizeSkipLogic(raw: unknown): Prisma.InputJsonValue | null {
  const rules = parseSkipLogic(raw);
  if (rules.length === 0) return null;
  return rules.map((rule) => ({
    operator: rule.operator,
    value: rule.value.slice(0, MAX_SURVEY_QUESTION_OPTION),
    skipToOrder: rule.skipToOrder,
  })) as Prisma.InputJsonValue;
}

function sanitizeColumnLabels(raw: unknown): Prisma.InputJsonValue | null {
  if (!Array.isArray(raw)) return null;
  const labels = raw
    .filter((label): label is string => typeof label === "string")
    .map((label) => label.slice(0, MAX_SURVEY_QUESTION_OPTION))
    .slice(0, MAX_MATRIX_COLUMNS);
  return labels.length > 0 ? (labels as Prisma.InputJsonValue) : null;
}

/**
 * Persisted per-question academic fields. `blockId` is remapped by the caller
 * from builder-local block ids to real SurveyBlock ids via `blockIdMap`.
 */
function buildQuestionExtras(
  question: {
    shuffleOptions?: boolean;
    skipLogic?: unknown;
    columnLabels?: unknown;
    blockId?: string | null;
  },
  blockIdMap: Map<string, string>,
): Pick<
  Prisma.SurveyQuestionUncheckedCreateInput,
  "shuffleOptions" | "skipLogic" | "columnLabels" | "blockId"
> {
  const extras: Pick<
    Prisma.SurveyQuestionUncheckedCreateInput,
    "shuffleOptions" | "skipLogic" | "columnLabels" | "blockId"
  > = {
    shuffleOptions: question.shuffleOptions === true,
    blockId: question.blockId ? blockIdMap.get(question.blockId) : null,
  };
  const skipLogic = sanitizeSkipLogic(question.skipLogic);
  if (skipLogic !== null) extras.skipLogic = skipLogic;
  const columnLabels = sanitizeColumnLabels(question.columnLabels);
  if (columnLabels !== null) extras.columnLabels = columnLabels;
  return extras;
}

export async function getSurveys(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  const where = {
    isDeleted: false,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  return prisma.researchSurvey.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      description: true,
      privacy: true,
      shareData: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      status: true,
      isDeleted: true,
      totalVotes: true,
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      totalResponses: true,
      trendingScore: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          followers: userId
            ? {
                where: { followerId: userId },
                select: { followerId: true },
              }
            : false,
        },
      },
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
}

export const getSurvey = cache(async (id: string, userId?: string) => {
  return prisma.researchSurvey.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      title: true,
      description: true,
      privacy: true,
      shareData: true,
      consentRequired: true,
      consentText: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      status: true,
      isDeleted: true,
      totalVotes: true,
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      totalResponses: true,
      trendingScore: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          followers: userId
            ? {
                where: { followerId: userId },
                select: { followerId: true },
              }
            : false,
        },
      },
      questions: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        include: {
          options: {
            where: { archivedAt: null },
            orderBy: { order: "asc" },
          },
        },
      },
      blocks: {
        orderBy: { order: "asc" },
      },
      comments: {
        where: { parentId: null, isDeleted: false },
        // LAZY PAGINATION: first page of parents only; replies load on demand.
        take: COMMENT_PAGE_SIZE + 1,
        select: {
          isDeleted: true,
          isFrozen: true,
          hasActiveAppeal: true,
          deletedByType: true,
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          editedAt: true,
          parentId: true,
          authorId: true,
          totalVotes: true,
          totalReplies: true,
          author: {
            select: {
              id: true,
              name: true,
              handle: true,
              avatarUrl: true,
            },
          },
          votes: userId
            ? { where: { userId }, select: { voteType: true } }
            : false,
          mentions: true,
        },
        orderBy: { createdAt: "desc" },
      },
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
});

export async function getSurveyResponse(surveyId: string, userId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== userId) return null;

  return prisma.surveyResponse.findFirst({
    where: {
      surveyId,
      respondentId: userId,
    },
    include: {
      answers: true,
    },
  });
}

export async function createSurvey(formData: FormData) {
  const user = await requireActiveUser("Please log in to create a survey.");
  await enforceRateLimit({ namespace: "survey:create", key: user.id, limit: 10, window: "10 m" });

  const title = readFormValue(formData, "title");
  const description = readOptionalFormValue(formData, "description");
  const privacy = readFormValue(formData, "privacy") as
    "ANONYMOUS" | "NON_ANONYMOUS" | "HYBRID";
  const shareData = formData.get("shareData") === "true";
  const questionsJson = readFormValue(formData, "questions");
  const consentRequired = formData.get("consentRequired") === "true";
  const consentText = sanitizeConsentText(formData.get("consentText"));

  if (!title) throw new Error("Title is required");
  if (!questionsJson) throw new Error("Questions are required");

  // Rich-text description: validate the plain-text length only and store the
  // full HTML payload (never slice HTML).
  assertRichTextWithinLimit(description ?? "", MAX_SURVEY_DESCRIPTION, "Survey description");

  const questions = JSON.parse(questionsJson) as SurveyQuestionInput[];
  const blocks = parseBlockInputs(readOptionalFormValue(formData, "blocks"));

  const survey = await prisma.$transaction(async (tx) => {
    const newSurvey = await tx.researchSurvey.create({
      data: {
        title,
        description,
        privacy: privacy || "HYBRID",
        shareData,
        authorId: user.id,
        consentRequired,
        consentText,
      },
    });

    // Blocks are created first so builder-local block ids on questions can be
    // remapped to real SurveyBlock ids before the questions are written.
    const blockIdMap = new Map<string, string>();
    for (const block of blocks) {
      const created = await tx.surveyBlock.create({
        data: {
          surveyId: newSurvey.id,
          title: block.title,
          order: block.order,
          randomizeOrder: block.randomizeOrder,
        },
      });
      if (block.id) blockIdMap.set(block.id, created.id);
    }

    await tx.surveyQuestion.createMany({
      data: questions.map((q) => ({
        surveyId: newSurvey.id,
        type: q.type as SurveyQuestionType,
        title: q.title,
        required: q.required,
        order: q.order,
        minValue: q.minValue ?? null,
        maxValue: q.maxValue ?? null,
        ...buildQuestionExtras(q, blockIdMap),
      })),
    });

    // Options cannot be nested in createMany — create them per question.
    const savedQuestions = await tx.surveyQuestion.findMany({
      where: { surveyId: newSurvey.id },
      select: { id: true, order: true },
    });
    const savedByOrder = new Map(savedQuestions.map((q) => [q.order, q.id]));

    for (const q of questions) {
      if (!q.options?.length) continue;
      const questionId = savedByOrder.get(q.order);
      if (!questionId) continue;
      await tx.surveyQuestionOption.createMany({
        data: q.options.map(({ value, label, order }) => ({
          questionId,
          value,
          label,
          order,
        })),
      });
    }

    const complete = await tx.researchSurvey.findUniqueOrThrow({
      where: { id: newSurvey.id },
      include: {
        author: true,
        votes: true,
        questions: { include: { options: true } },
      },
    });

 await tx.user.update({
   where: { id: user.id },
   data: { surveyCount: { increment: 1 }, reputation: { increment: 1 } },
 });

    return complete;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "survey",
    targetId: survey.id,
    title: `${user.email?.split("@")[0] || "Someone"} created a new survey`,
    body: title,
  });

  return { success: true, data: survey };
}

export async function updateSurvey(formData: FormData, surveyId: string) {
  const user = await requireActiveUser("Log in to edit this survey.");
  await enforceRateLimit({ namespace: "survey:edit", key: user.id, limit: 20, window: "10 m" });

  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: { authorId: true },
  });
  if (!survey) {
    throw new Error("Survey not found.");
  }
  if (!(await isAuthorizedOrAdmin(survey.authorId, user.id)))
    throw new Error("Not authorized to edit this survey.");

  const title = readFormValue(formData, "title");
  const description = readOptionalFormValue(formData, "description");
  const privacy = readFormValue(formData, "privacy") as
    "ANONYMOUS" | "NON_ANONYMOUS" | "HYBRID";
  const shareData = formData.get("shareData") === "true";
  const questionsJson = readFormValue(formData, "questions");
  const consentRequired = formData.get("consentRequired") === "true";
  const consentText = sanitizeConsentText(formData.get("consentText"));

  if (!title) throw new Error("Title is required");

  // Rich-text description: validate the plain-text length only and store the
  // full HTML payload (never slice HTML).
  assertRichTextWithinLimit(description ?? "", MAX_SURVEY_DESCRIPTION, "Survey description");

  const questions = questionsJson
    ? (JSON.parse(questionsJson) as SurveyQuestionInput[])
    : [];
  const blocks = parseBlockInputs(readOptionalFormValue(formData, "blocks"));

  const submittedIds = questions.flatMap((question) =>
    question.id ? [question.id] : [],
  );
  if (new Set(submittedIds).size !== submittedIds.length) {
    throw new Error("Each survey question may only be submitted once.");
  }

  await prisma.$transaction(async (tx) => {
    const existingQuestions = await tx.surveyQuestion.findMany({
      where: { surveyId, archivedAt: null },
      select: {
        id: true,
        title: true,
        type: true,
        options: { where: { archivedAt: null } },
        totalAnswers: true,
      },
    });
    const existingById = new Map(
      existingQuestions.map((question) => [question.id, question]),
    );

    // Block diff: update existing, create new, hard-delete removed (blocks
    // carry no response data; questions detach via onDelete: SetNull).
    const existingBlocks = await tx.surveyBlock.findMany({
      where: { surveyId },
      select: { id: true },
    });
    const existingBlockIds = new Set(existingBlocks.map((b) => b.id));
    const submittedBlockIds = new Set(
      blocks.flatMap((b) => (b.id ? [b.id] : [])),
    );

    const blockIdMap = new Map<string, string>();
    for (const block of blocks) {
      if (block.id && existingBlockIds.has(block.id)) {
        await tx.surveyBlock.update({
          where: { id: block.id },
          data: {
            title: block.title,
            order: block.order,
            randomizeOrder: block.randomizeOrder,
          },
        });
        blockIdMap.set(block.id, block.id);
      } else {
        const created = await tx.surveyBlock.create({
          data: {
            surveyId,
            title: block.title,
            order: block.order,
            randomizeOrder: block.randomizeOrder,
          },
        });
        if (block.id) blockIdMap.set(block.id, created.id);
      }
    }
    const removedBlockIds = [...existingBlockIds].filter(
      (id) => !submittedBlockIds.has(id),
    );
    if (removedBlockIds.length > 0) {
      await tx.surveyBlock.deleteMany({
        where: { id: { in: removedBlockIds } },
      });
    }

    for (const question of questions) {
      const existing = question.id ? existingById.get(question.id) : undefined;

      if (question.id && !existing) {
        throw new Error(
          "One of the survey questions is no longer available to edit.",
        );
      }
      if (
        existing &&
        existing.type !== question.type &&
        existing.totalAnswers > 0
      ) {
        throw new Error(
          `Cannot change the type of \"${existing.title}\" because it already has responses.`,
        );
      }

      if (!existing) {
        await tx.surveyQuestion.create({
          data: {
            surveyId,
            type: question.type as SurveyQuestionType,
            title: question.title,
            required: question.required,
            order: question.order,
            minValue: question.minValue,
            maxValue: question.maxValue,
            ...buildQuestionExtras(question, blockIdMap),
            options: question.options?.length
              ? {
                  create: question.options.map(({ value, label, order }) => ({
                    value,
                    label,
                    order,
                  })),
                }
              : undefined,
          },
        });
        continue;
      }

      await tx.surveyQuestion.update({
        where: { id: existing.id },
        data: {
          type: question.type as SurveyQuestionType,
          title: question.title,
          required: question.required,
          order: question.order,
          minValue: question.minValue,
          maxValue: question.maxValue,
          ...buildQuestionExtras(question, blockIdMap),
        },
      });

      const submittedOptionIds = new Set(
        question.options?.flatMap((option) => (option.id ? [option.id] : [])) ??
          [],
      );
      const existingOptionsById = new Map(
        existing.options.map((option) => [option.id, option]),
      );

      for (const option of question.options ?? []) {
        const existingOption = option.id
          ? existingOptionsById.get(option.id)
          : undefined;
        if (option.id && !existingOption) {
          throw new Error(
            `An option in \"${existing.title}\" is no longer available to edit.`,
          );
        }
        if (existingOption) {
          await tx.surveyQuestionOption.update({
            where: { id: existingOption.id },
            data: {
              value: option.value,
              label: option.label,
              order: option.order,
            },
          });
        } else {
          await tx.surveyQuestionOption.create({
            data: {
              questionId: existing.id,
              value: option.value,
              label: option.label,
              order: option.order,
            },
          });
        }
      }

      const removedOptionIds = existing.options
        .filter((option) => !submittedOptionIds.has(option.id))
        .map((option) => option.id);
      if (removedOptionIds.length) {
        await tx.surveyQuestionOption.updateMany({
          where: { id: { in: removedOptionIds } },
          data: { archivedAt: new Date() },
        });
      }
    }

    const removedQuestions = existingQuestions.filter(
      (question) => !submittedIds.includes(question.id),
    );
    for (const question of removedQuestions) {
      if (question.totalAnswers > 0) {
        await tx.surveyQuestion.update({
          where: { id: question.id },
          data: {
            archivedAt: new Date(),
            options: {
              updateMany: { where: {}, data: { archivedAt: new Date() } },
            },
          },
        });
      } else {
        await tx.surveyQuestion.delete({ where: { id: question.id } });
      }
    }

    await tx.researchSurvey.update({
      where: { id: surveyId },
      data: {
        title,
        description,
        privacy: privacy || "HYBRID",
        shareData,
        consentRequired,
        consentText,
        editedAt: new Date(),
      },
    });
  });

  const updatedSurvey = await getSurvey(surveyId, user.id);

  return { success: true, data: updatedSurvey };
}

export async function deleteSurvey(surveyId: string) {
  const user = await requireActiveUser("Log in to delete this survey.");
  await enforceRateLimit({ namespace: "survey:delete", key: user.id, limit: 20, window: "10 m" });

  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: { authorId: true, totalVotes: true },
  });
  if (!survey) {
    throw new Error("Survey not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    survey.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.researchSurvey.update({
      where: { id: surveyId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: survey.authorId },
       data: { surveyCount: { decrement: 1 }, reputation: { decrement: 1 } },
     });

     if (survey.totalVotes !== 0) {
      await tx.user.update({
        where: { id: survey.authorId },
        data: { reputation: { decrement: survey.totalVotes } },
      });
    }
  });

  return { success: true, data: { deletedId: surveyId } };
}

export async function closeSurvey(surveyId: string) {
  const user = await requireActiveUser("Log in to close this survey.");
  await enforceRateLimit({ namespace: "survey:edit", key: user.id, limit: 20, window: "10 m" });

  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: { authorId: true },
  });
  if (!survey) {
    throw new Error("Survey not found.");
  }
  if (!(await isAuthorizedOrAdmin(survey.authorId, user.id)))
    throw new Error("Not authorized.");

  const updatedSurvey = await prisma.researchSurvey.update({
    where: { id: surveyId },
    data: { status: "CLOSED" },
    include: {
      author: true,
      votes: true,
      questions: { include: { options: true } },
    },
  });
  return { success: true, data: updatedSurvey };
}

export async function reopenSurvey(surveyId: string) {
  const user = await requireActiveUser("Log in to reopen this survey.");
  await enforceRateLimit({ namespace: "survey:edit", key: user.id, limit: 20, window: "10 m" });

  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: { authorId: true },
  });
  if (!survey) {
    throw new Error("Survey not found.");
  }
  if (!(await isAuthorizedOrAdmin(survey.authorId, user.id)))
    throw new Error("Not authorized.");

  const updatedSurvey = await prisma.researchSurvey.update({
    where: { id: surveyId },
    data: { status: "OPEN" },
    include: {
      author: true,
      votes: true,
      questions: { include: { options: true } },
    },
  });
  return { success: true, data: updatedSurvey };
}

export async function toggleShareData(surveyId: string) {
  const user = await requireActiveUser("Log in to manage this survey.");
  await enforceRateLimit({ namespace: "survey:edit", key: user.id, limit: 20, window: "10 m" });

  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: { authorId: true, shareData: true },
  });
  if (!survey) {
    throw new Error("Survey not found.");
  }
  if (!(await isAuthorizedOrAdmin(survey.authorId, user.id)))
    throw new Error("Not authorized.");

  const updatedSurvey = await prisma.researchSurvey.update({
    where: { id: surveyId },
    data: { shareData: !survey.shareData },
    include: {
      author: true,
      votes: true,
      questions: { include: { options: true } },
    },
  });

  return { success: true, data: updatedSurvey };
}

export async function submitSurveyResponse(
  formData: FormData,
  surveyId: string,
) {
  let user;
  try {
    user = await requireActiveUser("Log in to submit a survey response.");
  } catch {
    return { error: "UNAUTHORIZED" };
  }

  const responseRateLimit = await checkRateLimit({
    namespace: "survey:response",
    key: user.id,
    limit: 30,
    window: "10 m",
  });
  if (!responseRateLimit.allowed) return { error: RATE_LIMIT_ERROR };

  const isAnonymous = formData.get("isAnonymous") === "true";

  // IRB CONSENT GATE: enforce server-side, never trust the client toggle.
  const consented = formData.get("consented") === "true";

  // RESPONSE METADATA: startedAt comes from the client form mount so
  // completion duration is derivable; clamped to a sane window to prevent
  // garbage data (future timestamps or multi-day staleness).
  const completedAt = new Date();
  const startedAtMs = Date.parse(String(formData.get("startedAt") ?? ""));
  const startedAt =
    Number.isFinite(startedAtMs) &&
    startedAtMs <= completedAt.getTime() + 5 * 60 * 1000 &&
    completedAt.getTime() - startedAtMs <= MAX_RESPONSE_DURATION_MS
      ? new Date(startedAtMs)
      : completedAt;
  const parsedSeed = Number.parseInt(String(formData.get("seed") ?? ""), 10);
  const randomizationSeed =
    Number.isInteger(parsedSeed) && parsedSeed > 0 && parsedSeed < 2 ** 31
      ? parsedSeed
      : null;

  const answersJson = readFormValue(formData, "answers");
  if (!answersJson) throw new Error("Answers are required");

  // 1. Parse the initial FormData string
  const rawAnswers = JSON.parse(answersJson) as Array<{
    questionId: string;
    value: string;
  }>;

  // 2. Format the values for Prisma JSONB
  const parsedAnswers = rawAnswers.map((ans) => {
    let finalValue: Prisma.InputJsonValue = ans.value;

    // Try to parse stringified arrays (from checkboxes) into real JS arrays.
    // This allows Prisma to save them as native JSON arrays in PostgreSQL.
    try {
      const parsed = JSON.parse(ans.value);
      if (typeof parsed === "object" && parsed !== null) {
        finalValue = parsed;
      }
    } catch {
      // It's a normal text string (Short text, radio, etc.), leave it alone
    }

    return {
      questionId: ans.questionId,
      value: finalValue,
    };
  });

  // SKIP LOGIC (server-side re-validation): the client hides skipped
  // questions for UX, but the server is the source of truth — answers to
  // questions hidden by an earlier trigger's rule are pruned so the dataset
  // stays analytically clean ("not applicable", never "missing").
  const surveyForValidation = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: {
      consentRequired: true,
      questions: {
        where: { archivedAt: null },
        select: { id: true, order: true, skipLogic: true },
      },
    },
  });
  if (!surveyForValidation) {
    return { error: "This survey is no longer available." };
  }
  if (surveyForValidation.consentRequired && !consented) {
    return { error: "CONSENT_REQUIRED" };
  }

  let validatedAnswers = parsedAnswers;
  if (surveyForValidation.questions.some((q) => q.skipLogic != null)) {
    const valueById = new Map(parsedAnswers.map((a) => [a.questionId, a.value]));
    const skippedIds = computeSkippedQuestionIds(
      surveyForValidation.questions,
      (id) => valueById.get(id),
    );
    if (skippedIds.size > 0) {
      validatedAnswers = parsedAnswers.filter((a) => !skippedIds.has(a.questionId));
    }
  }
  const answers = validatedAnswers;

  const activeQuestionCount = await prisma.surveyQuestion.count({
    where: {
      surveyId,
      archivedAt: null,
      id: { in: answers.map((answer) => answer.questionId) },
    },
  });
  if (
    activeQuestionCount !==
    new Set(answers.map((answer) => answer.questionId)).size
  ) {
    return {
      error:
        "This survey changed before your response was submitted. Please refresh and try again.",
    };
  }

  // Check if user already responded - if so, update existing response (upsert pattern)
  const existingResponse = await prisma.surveyResponse.findFirst({
    where: {
      surveyId,
      respondentId: user.id,
    },
  });

  if (existingResponse) {
    // Retain answers to archived questions as historical data, while
    // replacing responses to questions that remain active in the form.
    const deletedAnswers = await prisma.surveyAnswer.findMany({
      where: {
        responseId: existingResponse.id,
        question: { archivedAt: null },
      },
      select: { questionId: true },
    });
    await prisma.surveyAnswer.deleteMany({
      where: {
        responseId: existingResponse.id,
        question: { archivedAt: null },
      },
    });
    const updatedResponse = await prisma.surveyResponse.update({
      where: { id: existingResponse.id },
      data: {
        isAnonymous,
        ...(surveyForValidation.consentRequired && consented
          ? { consentedAt: completedAt }
          : {}),
        startedAt,
        completedAt,
        randomizationSeed,
        answers: {
          create: answers.map((a) => ({
            question: { connect: { id: a.questionId } },
            value: a.value,
          })),
        },
      },
      include: { answers: true },
    });

    const newQuestionIds = [...new Set(answers.map((a) => a.questionId))];
    const deletedQuestionIds = [
      ...new Set(deletedAnswers.map((a) => a.questionId)),
    ];
    const questionsToDecrement = deletedQuestionIds.filter(
      (id) => !newQuestionIds.includes(id),
    );
    const questionsToIncrement = newQuestionIds.filter(
      (id) => !deletedQuestionIds.includes(id),
    );

    if (questionsToIncrement.length > 0) {
      await prisma.surveyQuestion.updateMany({
        where: { id: { in: questionsToIncrement } },
        data: { totalAnswers: { increment: 1 } },
      });
    }
    if (questionsToDecrement.length > 0) {
      await prisma.surveyQuestion.updateMany({
        where: { id: { in: questionsToDecrement } },
        data: { totalAnswers: { decrement: 1 } },
      });
    }

    return { success: true, data: updatedResponse };
  }

  const uniqueQuestionIds = [...new Set(answers.map((a) => a.questionId))];

  const newResponse = await prisma.$transaction(async (tx) => {
    const response = await tx.surveyResponse.create({
      data: {
        surveyId,
        // Always link the response to the authenticated user so they can
        // retrieve and edit their own previous response later. Anonymity
        // is preserved via the isAnonymous flag (used in results/export).
        respondentId: user.id,
        isAnonymous,
        ...(surveyForValidation.consentRequired && consented
          ? { consentedAt: completedAt }
          : {}),
        startedAt,
        completedAt,
        randomizationSeed,
        answers: {
          create: answers.map((a) => ({
            question: { connect: { id: a.questionId } },
            value: a.value,
          })),
        },
      },
      include: { answers: true },
    });

    // RULE 3: Atomic transaction — all counter updates together with create
    await tx.researchSurvey.update({
      where: { id: surveyId },
      data: { totalResponses: { increment: 1 } },
    });

    await tx.surveyQuestion.updateMany({
      where: { id: { in: uniqueQuestionIds } },
      data: { totalAnswers: { increment: 1 } },
    });

     // Award 1 reputation point for participating in a survey
     await tx.user.update({
       where: { id: user.id },
       data: { reputation: { increment: 1 }, surveyParticipationCount: { increment: 1 } },
     });

    return response;
  });

  return { success: true, data: newResponse };
}

export async function getSurveyResponses(surveyId: string, userId?: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== userId) return null;

  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: { authorId: true },
  });
  if (!survey) return null;
  if (survey.authorId !== userId) return null;

  return prisma.surveyResponse.findMany({
    where: { surveyId },
    include: {
      respondent: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
      answers: {
        include: {
          question: {
            select: { id: true, title: true, type: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSurveyResults(surveyId: string) {
  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: {
      id: true,
      title: true,
      authorId: true,
      shareData: true,
      totalResponses: true,
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: { orderBy: { order: "asc" } },
          answers: true,
        },
      },
    },
  });
  if (!survey) return null;

  const currentUser = await getCurrentUser();
  const isAdmin = currentUser ? await isUserAdmin(currentUser.id) : false;
  if (!survey.shareData && survey.authorId !== currentUser?.id && !isAdmin) {
    return null;
  }

  return survey;
}

export async function hasUserResponded(surveyId: string, userId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== userId) return false;

  // Check if user is the survey author - authors can always respond (preview)
  const survey = await prisma.researchSurvey.findUnique({
    where: { id: surveyId },
    select: { authorId: true },
  });
  if (survey?.authorId === userId) return false;

  const response = await prisma.surveyResponse.findFirst({
    where: {
      surveyId,
      respondentId: userId,
    },
  });
  return !!response;
}
