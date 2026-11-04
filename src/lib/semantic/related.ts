/**
 * Same-type "related" lookups for detail pages.
 *
 * One HNSW query per page returns the nearest embedded rows of the same entity
 * type, then one primary-key query hydrates them for rendering. Search never
 * calls this module; the list search bars stay on trigram + tsvector indexes.
 *
 * The source vector is a scalar subquery for the same reason as `matching.ts`:
 * pgvector only uses the partial HNSW index when the distance operand is an
 * InitPlan. Keep the repeated subquery when editing.
 */
import { Prisma } from "@prisma/client";

import prisma from "@/lib/db";
import { stripHtmlTags } from "@/lib/html";

import { clampMatchLimit, type SemanticMatch } from "./matching";
import { EMBEDDING_TABLES, type EmbeddingEntityType } from "./text";

const DEFAULT_RELATED_LIMIT = 6;

export type RelatedContentItem = {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  similarity: number;
};

type HydratedItem = Omit<RelatedContentItem, "id" | "similarity">;

function tableReference(entityType: EmbeddingEntityType) {
  return Prisma.raw(`"${EMBEDDING_TABLES[entityType]}"`);
}

/**
 * Extra public-visibility predicates that are not shared by every table.
 * Contribution is the only module whose list is gated on a moderation status;
 * everything else is public once `isDeleted` is false.
 */
const RELATED_FILTERS: Partial<Record<EmbeddingEntityType, Prisma.Sql>> = {
  CONTRIBUTION: Prisma.raw(`AND candidate."status" = 'APPROVED'`),
};

function excerpt(value: string, max = 96): string {
  const text = stripHtmlTags(value).replace(/\s+/g, " ").trim();

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1).trimEnd()}…`;
}

async function findRelatedMatches(
  entityType: EmbeddingEntityType,
  entityId: string,
  limit: number,
): Promise<SemanticMatch[]> {
  const table = tableReference(entityType);
  const extraFilter = RELATED_FILTERS[entityType] ?? Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{ id: string; similarity: number | string }>
  >(Prisma.sql`
    SELECT
      candidate."id",
      (
        1 - (
          candidate."embedding" <=> (
            SELECT "embedding"
            FROM ${table}
            WHERE "id" = ${entityId}
              AND "isDeleted" = false
              AND "embedding" IS NOT NULL
          )
        )
      )::float8 AS "similarity"
    FROM ${table} AS candidate
    WHERE candidate."isDeleted" = false
      AND candidate."embedding" IS NOT NULL
      AND candidate."id" <> ${entityId}
      ${extraFilter}
    ORDER BY candidate."embedding" <=> (
      SELECT "embedding"
      FROM ${table}
      WHERE "id" = ${entityId}
        AND "isDeleted" = false
        AND "embedding" IS NOT NULL
    )
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    id: row.id,
    similarity: Number(row.similarity),
  }));
}

async function hydrateItems(
  entityType: EmbeddingEntityType,
  ids: string[],
): Promise<Map<string, HydratedItem>> {
  const where = { id: { in: ids } };
  const items = new Map<string, HydratedItem>();

  switch (entityType) {
    case "SCHOLAR": {
      const rows = await prisma.user.findMany({
        where,
        select: { id: true, name: true, handle: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/scholars/${row.id}`,
          title: row.name ?? "Scholar",
          subtitle: row.handle ? `@${row.handle}` : undefined,
        });
      }
      break;
    }

    case "SOCIAL_POST": {
      const rows = await prisma.socialPost.findMany({
        where,
        select: { id: true, content: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/feed/${row.id}`,
          title: excerpt(row.content) || "Post",
        });
      }
      break;
    }

    case "PUBLICATION": {
      const rows = await prisma.publication.findMany({
        where,
        select: { id: true, title: true, authors: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/publications/${row.id}`,
          title: row.title,
          subtitle: excerpt(row.authors, 80),
        });
      }
      break;
    }

    case "ARTICLE": {
      const rows = await prisma.article.findMany({
        where,
        select: { id: true, slug: true, title: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/blog/${row.slug}`,
          title: row.title,
        });
      }
      break;
    }

    case "HELP_POST": {
      const rows = await prisma.helpPost.findMany({
        where,
        select: { id: true, title: true, category: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/help/${row.id}`,
          title: row.title,
          subtitle: row.category,
        });
      }
      break;
    }

    case "CONTRIBUTION": {
      const rows = await prisma.contribution.findMany({
        where,
        select: { id: true, title: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/contributions/${row.id}`,
          title: row.title,
        });
      }
      break;
    }

    case "RESEARCH_TOOL": {
      const rows = await prisma.researchTool.findMany({
        where,
        select: { id: true, name: true, use: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/research-tools/${row.id}`,
          title: row.name,
          subtitle: excerpt(row.use, 80),
        });
      }
      break;
    }

    case "RESEARCH_GRANT": {
      const rows = await prisma.researchGrant.findMany({
        where,
        select: { id: true, title: true, amount: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/grants/${row.id}`,
          title: row.title,
          subtitle: row.amount ?? undefined,
        });
      }
      break;
    }

    case "COURSE": {
      const rows = await prisma.course.findMany({
        where,
        select: { id: true, title: true, provider: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/learn/${row.id}`,
          title: row.title,
          subtitle: row.provider ?? undefined,
        });
      }
      break;
    }

    case "JOURNAL": {
      const rows = await prisma.journal.findMany({
        where,
        select: { id: true, title: true, publisher: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/journals/${row.id}`,
          title: row.title,
          subtitle: row.publisher ?? undefined,
        });
      }
      break;
    }

    case "RESULT": {
      const rows = await prisma.result.findMany({
        where,
        select: { id: true, title: true, conductingBody: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/results/${row.id}`,
          title: row.title,
          subtitle: row.conductingBody ?? undefined,
        });
      }
      break;
    }

    case "RESEARCH_SURVEY": {
      const rows = await prisma.researchSurvey.findMany({
        where,
        select: { id: true, title: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/surveys/${row.id}`,
          title: row.title,
        });
      }
      break;
    }

    case "RESEARCH_EVENT": {
      const rows = await prisma.researchEvent.findMany({
        where,
        select: { id: true, title: true, location: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/events/${row.id}`,
          title: row.title,
          subtitle: row.location,
        });
      }
      break;
    }

    case "PHD_ADMISSION": {
      const rows = await prisma.phdAdmission.findMany({
        where,
        select: { id: true, university: true, department: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/admissions/${row.id}`,
          title: row.university,
          subtitle: row.department,
        });
      }
      break;
    }

    case "JOB_VACANCY": {
      const rows = await prisma.jobVacancy.findMany({
        where,
        select: { id: true, title: true, institution: true },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/vacancies/${row.id}`,
          title: row.title,
          subtitle: row.institution,
        });
      }
      break;
    }

    case "SUPERVISOR": {
      const rows = await prisma.supervisor.findMany({
        where,
        select: {
          id: true,
          name: true,
          university: true,
          department: true,
        },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/supervisor/${row.id}`,
          title: row.name,
          subtitle: `${row.university} · ${row.department}`,
        });
      }
      break;
    }

    case "RECOMMENDATION": {
      const rows = await prisma.recommendation.findMany({
        where,
        select: {
          id: true,
          feedback: true,
          supervisorId: true,
          supervisor: { select: { name: true } },
        },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/supervisor/${row.supervisorId}/recommendation/${row.id}`,
          title: excerpt(row.feedback) || "Recommendation",
          subtitle: row.supervisor.name,
        });
      }
      break;
    }

    case "JOURNAL_REVIEW": {
      const rows = await prisma.journalReview.findMany({
        where,
        select: {
          id: true,
          feedback: true,
          journalId: true,
          journal: { select: { title: true } },
        },
      });

      for (const row of rows) {
        items.set(row.id, {
          href: `/journals/${row.journalId}/review/${row.id}`,
          title: excerpt(row.feedback) || "Journal review",
          subtitle: row.journal.title,
        });
      }
      break;
    }
  }

  return items;
}

/**
 * Nearest same-type content for a detail page. Returns `[]` when the source
 * has no vector yet (fresh row, worker not run) or nothing is close enough to
 * hydrate. Callers render nothing for an empty list.
 */
export async function getRelatedContent(
  entityType: EmbeddingEntityType,
  entityId: string,
  limit?: number,
): Promise<RelatedContentItem[]> {
  try {
    const matches = await findRelatedMatches(
      entityType,
      entityId,
      clampMatchLimit(limit ?? DEFAULT_RELATED_LIMIT),
    );

    if (matches.length === 0) {
      return [];
    }

    const hydrated = await hydrateItems(
      entityType,
      matches.map((match) => match.id),
    );

    return matches.flatMap((match) => {
      const item = hydrated.get(match.id);

      if (!item) {
        return [];
      }

      return [{ ...item, id: match.id, similarity: match.similarity }];
    });
  } catch (error) {
    // Recommendations are additive: a missing pgvector extension, an
    // unmigrated table, or a transient query failure must not take down the
    // detail page. The next request retries.
    console.error(
      `[related-content] ${entityType}:${entityId} lookup failed`,
      error,
    );
    return [];
  }
}
