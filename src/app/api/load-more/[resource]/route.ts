import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getArticles } from "@/app/actions/blog";
import { getFeed } from "@/app/actions/feed";
import { getResearchTools } from "@/app/actions/researchTools";
import { getPublications } from "@/app/actions/publications";
import { getEvents } from "@/app/actions/events";
import { getResearchGrants } from "@/app/actions/grants";
import { getScholars } from "@/app/actions/scholars";
import { getAdmissions } from "@/app/actions/admissions";
import { getResults } from "@/app/actions/results";
import { getVacancies } from "@/app/actions/vacancies";
import { getSupervisors } from "@/app/actions/supervisors";
import { getJournals } from "@/app/actions/journals";
import { getContributions } from "@/app/actions/contributions";
import { getSurveys } from "@/app/actions/surveys";
import { getHelpPosts } from "@/app/actions/help";
import { getCourses } from "@/app/actions/courses";

const CHUNK = 10;

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const searchParams = req.nextUrl.searchParams;
  const cursor = searchParams.get("cursor") || undefined;
  const q = searchParams.get("q") || undefined;
  const tab = searchParams.get("tab") || undefined;
  const sort = searchParams.get("sort") || undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const limit = CHUNK;

  let items: unknown[] = [];
  switch (resource) {
    case "blog":
      items = await getArticles(q, user?.id, limit, cursor);
      break;
    case "feed":
      items = await getFeed(user?.id, tab, q, limit, cursor);
      break;
    case "research-tools":
      items = await getResearchTools(q, user?.id, limit, cursor);
      break;
    case "publications":
      items = await getPublications(q, user?.id, limit, cursor);
      break;
    case "events":
      items = await getEvents(q, user?.id, limit, cursor);
      break;
    case "grants":
      items = await getResearchGrants(q, user?.id, limit, cursor);
      break;
    case "scholars":
      items = await getScholars(q, (sort === "reputation" ? "reputation" : "latest"), user?.id, limit, cursor);
      break;
    case "admissions":
      items = await getAdmissions(q, user?.id, limit, cursor);
      break;
    case "results":
      items = await getResults(q, user?.id, limit, cursor);
      break;
    case "vacancies":
      items = await getVacancies(q, user?.id, limit, cursor);
      break;
    case "supervisors":
      items = await getSupervisors(q, user?.id, limit, cursor);
      break;
    case "journals":
      items = await getJournals(q, user?.id, limit, cursor);
      break;
    case "contributions":
      items = await getContributions(q, user?.id, limit, cursor);
      break;
    case "surveys":
      items = await getSurveys(q, user?.id, limit, cursor);
      break;
    case "help":
      items = await getHelpPosts(q, user?.id, limit, cursor);
      break;
    case "courses":
      items = await getCourses(q, user?.id, limit, cursor);
      break;
    default:
      return NextResponse.json({ error: "Unknown resource" }, { status: 400 });
  }

  const nextCursor = items.length === CHUNK ? (items[items.length - 1] as { id?: string } | undefined)?.id ?? null : null;
  return NextResponse.json({ items, nextCursor, hasMore: items.length === CHUNK });
}
