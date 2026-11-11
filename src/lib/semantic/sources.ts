/**
 * Loads the embeddable text for every entity type in one batch.
 *
 * Kept separate from the worker so the queue/retry logic stays readable and
 * so the text source for each module sits next to the builder it feeds.
 * Every query is a single `findMany` by primary key; relation context for
 * reviews is fetched through the parent, never per row.
 */
import prisma from "@/lib/db";

import {
  buildArticleText,
  buildContributionText,
  buildCourseText,
  buildHelpPostText,
  buildAcademicPositionText,
  buildJournalReviewText,
  buildJournalText,
  buildAdmissionText,
  buildPublicationText,
  buildRecommendationText,
  buildCallForPaperText,
  buildResearchGrantText,
  buildResearchSurveyText,
  buildResearchToolText,
  buildResultText,
  buildScholarText,
  buildSocialPostText,
  buildSupervisorText,
  type EmbeddingEntityType,
} from "./text";

export type EmbeddingTextSource = {
  isDeleted: boolean;
  text: string;
};

export type EmbeddingSourceMap = Map<string, EmbeddingTextSource>;

type SourceRow = { id: string; isDeleted: boolean };

function collect<T extends SourceRow>(
  rows: T[],
  build: (row: T) => string,
): EmbeddingSourceMap {
  const sources: EmbeddingSourceMap = new Map();

  for (const row of rows) {
    sources.set(row.id, {
      isDeleted: row.isDeleted,
      text: build(row),
    });
  }

  return sources;
}

export async function loadEmbeddingSources(
  entityType: EmbeddingEntityType,
  ids: string[],
): Promise<EmbeddingSourceMap> {
  if (ids.length === 0) {
    return new Map();
  }

  const where = { id: { in: ids } };

  switch (entityType) {
    case "SCHOLAR": {
      const rows = await prisma.user.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          name: true,
          handle: true,
          bio: true,
          interests: true,
        },
      });
      return collect(rows, buildScholarText);
    }

    case "SOCIAL_POST": {
      const rows = await prisma.socialPost.findMany({
        where,
        select: { id: true, isDeleted: true, content: true },
      });
      return collect(rows, buildSocialPostText);
    }

    case "PUBLICATION": {
      const rows = await prisma.publication.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          authors: true,
          keywords: true,
          domain: true,
          journalOrConference: true,
          abstract: true,
        },
      });
      return collect(rows, buildPublicationText);
    }

    case "ARTICLE": {
      const rows = await prisma.article.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          excerpt: true,
          content: true,
        },
      });
      return collect(rows, buildArticleText);
    }

    case "HELP_POST": {
      const rows = await prisma.helpPost.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          subject: true,
          category: true,
          message: true,
        },
      });
      return collect(rows, buildHelpPostText);
    }

    case "CONTRIBUTION": {
      const rows = await prisma.contribution.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          message: true,
        },
      });
      return collect(rows, buildContributionText);
    }

    case "RESEARCH_TOOL": {
      const rows = await prisma.researchTool.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          name: true,
          use: true,
          description: true,
        },
      });
      return collect(rows, buildResearchToolText);
    }

    case "RESEARCH_GRANT": {
      const rows = await prisma.researchGrant.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          description: true,
        },
      });
      return collect(rows, buildResearchGrantText);
    }

    case "COURSE": {
      const rows = await prisma.course.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          provider: true,
          instructor: true,
          format: true,
          level: true,
          description: true,
        },
      });
      return collect(rows, buildCourseText);
    }

    case "JOURNAL": {
      const rows = await prisma.journal.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          publisher: true,
          about: true,
          subjectArea: true,
        },
      });
      return collect(rows, buildJournalText);
    }

    case "RESULT": {
      const rows = await prisma.result.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          description: true,
          category: true,
          conductingBody: true,
          session: true,
        },
      });
      return collect(rows, buildResultText);
    }

    case "RESEARCH_SURVEY": {
      const rows = await prisma.researchSurvey.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          description: true,
        },
      });
      return collect(rows, buildResearchSurveyText);
    }

    case "CALL_FOR_PAPER": {
      const rows = await prisma.callForPaper.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          category: true,
          eventDate: true,
          location: true,
          description: true,
        },
      });
      return collect(rows, buildCallForPaperText);
    }

    case "ADMISSION": {
      const rows = await prisma.admission.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          university: true,
          department: true,
          level: true,
          description: true,
        },
      });
      return collect(rows, buildAdmissionText);
    }

    case "ACADEMIC_POSITION": {
      const rows = await prisma.academicPosition.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          title: true,
          institution: true,
          department: true,
          subject: true,
          positionType: true,
          salaryOrStipend: true,
          contractDuration: true,
          location: true,
          description: true,
        },
      });
      return collect(rows, buildAcademicPositionText);
    }

    case "SUPERVISOR": {
      const rows = await prisma.supervisor.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          name: true,
          university: true,
          department: true,
          about: true,
        },
      });
      return collect(rows, buildSupervisorText);
    }

    case "RECOMMENDATION": {
      const rows = await prisma.recommendation.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          feedback: true,
          supervisor: {
            select: {
              name: true,
              university: true,
              department: true,
              about: true,
            },
          },
        },
      });
      return collect(rows, buildRecommendationText);
    }

    case "JOURNAL_REVIEW": {
      const rows = await prisma.journalReview.findMany({
        where,
        select: {
          id: true,
          isDeleted: true,
          feedback: true,
          journal: {
            select: {
              title: true,
              publisher: true,
              subjectArea: true,
              about: true,
            },
          },
        },
      });
      return collect(rows, buildJournalReviewText);
    }
  }
}
