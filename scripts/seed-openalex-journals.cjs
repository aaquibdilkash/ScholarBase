// Hybrid: bulk-import OpenAlex journals, attributed to your ScholarBase account
// Run: node scripts/seed-openalex-journals.cjs --dry-run --user-email you@domain.com
//      node scripts/seed-openalex-journals.cjs --live --user-email you@domain.com
//
// Reads: .env (OPENALEX_API_KEY, DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
//      CLI: --user-email, --dry-run, --live, --max-cost, --limit
//
// ---------------------------------------------------------------

// Use built-in Node fetch (Node 22+) and process.env - NO external deps needed
(async () => {
  const USER_EMAIL = process.argv.find((a) => a.startsWith("--user-email="))?.split("=")[1];
  const DRY_RUN = process.argv.includes("--dry-run");
  const LIVE = process.argv.includes("--live");
  const MAX_COST_USD = Number(
    process.argv.find((a) => a.startsWith("--max-cost="))?.split("=")[1]
  ) || Infinity;
  const LIMIT = Number(
    process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]
  ) || Infinity;

  if (!USER_EMAIL) {
    console.error("❌ Error: --user-email required (e.g. --user-email you@scholarbase.app)");
    process.exit(1);
  }
  if (!LIMIT && !LIVE) {
    console.error("Usage: node scripts/seed-openalex-journals.cjs [--dry-run] [--live] [--max-cost N] [--limit N] --user-email you@domain.com");
    process.exit(1);
  }

  // .env values are auto-loaded by the runtime in this project;
  // fall back to process.env if not auto-merged:
  const openalexApiKey = process.env.OPENALEX_API_KEY; // optional
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { Pool } = await import("pg");

  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL not found in environment.");
    process.exit(1);
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required.");
    process.exit(1);
  }

  // ---- Step 1: Look up user ID from Supabase via REST API ----
  async function lookupUserId(email) {
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id`, {
        headers: {
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
      });
      if (!resp.ok) throw new Error(`REST API error: ${resp.status}`);
      const users = await resp.json();
      if (users.length === 0) throw new Error("User not found in Supabase");
      return users[0].id;
    } catch {
      console.warn("⚠️ REST lookup failed, trying supa-js client...");
    }
    try {
      // Try supa-js client if available
      const { createClient } = await import("@supabase/supabase-js");
      const supa = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supa.auth.admin.getUserByEmail(email);
      if (error) throw error;
      return data.user.id;
    } catch {
      console.warn("⚠️ supa-js lookup also failed:");
    }
    console.error(`❌ Could not find user ID for email: ${email}`);
    process.exit(1);
  }

  const scholarUserId = await lookupUserId(USER_EMAIL);
  console.log(`✅ Found ScholarBase user ID: ${scholarUserId}`);

  // ---- Step 2: Constants ----
  const MIN_WORKS = 50;
  const MIN_YEAR = 2024;

  // ---- ISSN validation ----
  function normalizeISSN(raw) {
    if (!raw) return "";
    const clean = raw.replace(/[^0-9X]/g, "").toUpperCase();
    if (clean.length !== 8) return null;
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += parseInt(clean[i], 10) * (10 - i);
    const check = (11 - (sum % 11)) % 11;
    const expected = check === 10 ? "X" : check;
    const actual = clean[7] === "X" ? 10 : parseInt(clean[7], 10);
    if (actual !== expected) return null;
    return clean;
  }
  function isValidISSN(norm) {
    if (!norm) return false;
    const clean = normalizeISSN(norm);
    return clean !== null;
  }

  // ---- Load existing DB data for dedupe ----
  async function loadExistingDBData() {
    const pool = new Pool({ connectionString: databaseUrl });
    const { rows } = await pool.query(
      "SELECT issn, openalex_id FROM journal WHERE issn IS NOT NULL OR openalex_id IS NOT NULL"
    );
    await pool.end();
    return rows;
  }
  const existingDBData = await loadExistingDBData();
  const existingIssns = new Set(existingDBData.map((r) => normalizeISSN(r.issn ?? "")));
  const existingOaIds = new Set(existingDBData.map((r) => r.openalex_id ?? ""));
  function issnAlreadyExists(norm) {
    if (!norm) return true;
    return existingIssns.has(norm) || existingOaIds.has(`https://openalex.org/S${norm.replace(/-/g, "")}`);
  }

  // ---- Fetch from OpenAlex ----
  const API_ROOT = "https://api.openalex.org/sources";

  async function fetchPage(csr) {
    const url = new URL(API_ROOT);
    url.searchParams.set("filter", "type:journal,has_issn:true");
    url.searchParams.set("per-page", "100");
    url.searchParams.set(
      "select",
      "id,display_name,issn_l,host_organization_name,works_count,cited_by_count,is_oa,is_in_doaj,is_core,summary_stats,apc_usd,first_publication_year,last_publication_year,topics,listed_in"
    );
    if (csr) url.searchParams.set("cursor", csr);

    const headers = openalexApiKey ? { Authorization: `Bearer ${openalexApiKey}` } : {};
    const resp = await fetch(url.toString(), { headers });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`OpenAlex ${resp.status}: ${txt}`);
    }
    const data = await resp.json();

    const costPerCall = 0.0001;
    if (costUsdSpent + costPerCall > MAX_COST_USD) {
      console.error(`⛔ Max cost ${MAX_COST_USD}USD reached. Stopping.`);
      process.exit(1);
    }
    costUsdSpent += costPerCall;

    // Rate limit
    if (openalexApiKey) await new Promise(r => setTimeout(r, 50)); // ~30 req/s
    else await new Promise(r => setTimeout(r, 150)); // ~10 req/s keyless

    return { results: data.results ?? [], meta: data.meta, next_cursor: data?.meta?.next_cursor ?? null };
  }

  // ---- Quality gate ----
  function passesGate(src) {
    if (!src.issn_l) { rejectedReason[src.id] = "noISSN"; return false; }
    if (!isValidISSN(src.issn_l)) { rejectedReason[src.id] = "invalidISSNChecksum"; return false; }
    const norm = normalizeISSN(src.issn_l);
    if (issnAlreadyExists(norm)) { rejectedReason[src.id] = "duplicateISSN"; return false; }
    if ((src.works_count ?? 0) < MIN_WORKS) { rejectedReason[src.id] = `lowWorks(${src.works_count})`; return false; }
    if ((src.last_publication_year ?? 0) < MIN_YEAR) { rejectedReason[src.id] = `stale(${src.last_publication_year})`; return false; }
    if (src.is_preprint_repository) { rejectedReason[src.id] = "preprintRepo"; return false; }
    if (src.type !== "journal") { rejectedReason[src.id] = `type=${src.type}`; return false; }
    return true;
  }

  // ---- Build payload ----
  function buildPayload(src, userId) {
    const normIssn = normalizeISSN(src.issn_l ?? "");
    const openalexId = `https://openalex.org/S${src.id.replace(/^S/, "")}`;

    let oaStatus = "UNKNOWN";
    if (src.is_oa) {
      if (src.apc_usd > 0) oaStatus = "GOLD";
      else if (src.is_in_doaj) oaStatus = "DIAMOND";
      else oaStatus = "HYBRID";
    } else { oaStatus = "CLOSED"; }

    const subjectArea = (src.topics?.[0]?.field?.display_name || "").substring(0, 64);
    const openAccessEnum =
      oaStatus === "UNKNOWN" ? "UNKNOWN"
        : oaStatus === "GOLD" ? "GOLD"
        : oaStatus === "DIAMOND" ? "DIAMOND"
        : oaStatus === "HYBRID" ? "HYBRID" : "CLOSED";

    return {
      where: { openalexId },
      data: {
        authorId: userId,
        title: src.display_name,
        issn: normIssn,
        publisher: (src.host_organization_name ?? "").substring(0, 64),
        website: src.homepage_url && fetch(url.toString()).ok ? src.homepage_url : null, // simplified validation
        subjectArea,
        openAccess: openAccessEnum,
        worksCount: src.works_count,
        citedByCount: src.cited_by_count,
        hIndex: src.summary_stats?.[`h_index`] ?? null,
        doajListed: src.is_in_doaj,
        dataSource: "OPENALEX",
        lastSyncedAt: new Date(),
        impactFactor: src.summary_stats?.[`2yr_mean_citedness`] ?? null,
        scopusQuartile: null,
        abdcRanking: null,
        wosIndex: null,
        wosQuartile: null,
        sjrQuartile: null,
        sjrScore: null,
        citeScore: null,
      },
    };
  }

  // ---- DB helpers ----
  const pool = new Pool({ connectionString: databaseUrl });

  async function upsertJournal(payload) {
    const { data } = payload;
    const upsertSql = `
      INSERT INTO journal (
        id, title, issn, publisher, website, subject_area, open_access,
        works_count, cited_by_count, h_index, doaj_listed, data_source,
        last_synced_at, author_id, impact_factor, scopus_quartile, abdc_ranking,
        wos_index, wos_quartile, sjr_quartile, sjr_score, cite_score,
        created_at, updated_at, is_deleted, report_count
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW(), false, 0
      )
      ON CONFLICT ("openalex_id") DO UPDATE SET
        title = EXCLUDED.title, issn = EXCLUDED.issn, publisher = EXCLUDED.publisher,
        website = EXCLUDED.website, subject_area = EXCLUDED.subject_area,
        open_access = EXCLUDED.open_access, works_count = EXCLUDED.works_count,
        cited_by_count = EXCLUDED.cited_by_count, h_index = EXCLUDED.h_index,
        doaj_listed = EXCLUDED.doaj_listed, data_source = EXCLUDED.data_source,
        last_synced_at = EXCLUDED.last_synced_at, author_id = EXCLUDED.author_id,
        impact_factor = EXCLUDED.impact_factor, scopus_quartile = EXCLUDED.scopus_quartile,
        abdc_ranking = EXCLUDED.abdc_ranking, wos_index = EXCLUDED.wos_index,
        wos_quartile = EXCLUDED.wos_quartile, sjr_quartile = EXCLUDED.sjr_quartile,
        sjr_score = EXCLUDED.sjr_score, cite_score = EXCLUDED.cite_score, updated_at = NOW()
      RETURNING id;
    `;
    const values = [
      data.title, data.issn, data.publisher, data.website, data.subjectArea,
      data.openAccess, data.worksCount, data.citedByCount, data.hIndex,
      data.doajListed, data.dataSource, data.lastSyncedAt, data.authorId,
      data.impactFactor, data.scopusQuartile, data.abdcRanking,
      data.wosIndex, data.wosQuartile, data.sjrQuartile, data.sjrScore,
      data.citeScore,
    ];
    const { rows } = await pool.query(upsertSql, values);
    return rows[0].id;
  }

  async function incrementUserJournalCount(userId) {
    await pool.query(`UPDATE "user" SET journal_count = journal_count + 1 WHERE id = $1`, [userId]);
  }
  async function createUserActivity(userId, entityId, entityTitle) {
    await pool.query(
      `INSERT INTO "userActivity" ("userId", "action", "moduleType", "entityId", "entityTitle", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, "PUBLISHED", "JOURNAL", entityId, entityTitle]
    );
  }

  // ---- Main loop ----
  let cursor = "*";
  let totalFetched = 0, accepted = 0, rejected = 0;
  const rejectedReason = {};
  const costUsdSpent = { spent: 0 };

  try {
    while (totalFetched < LIMIT) {
      const { results, next_cursor } = await fetchPage(cursor);
      if (results.length === 0) break;

      for (const src of results) {
        totalFetched++;
        if (!passesGate(src)) {
          rejected++;
          rejectedReason[src.id] = rejectedReason[src.id] || "see above";
          continue;
        }
        const payload = buildPayload(src, scholarUserId);
        await upsertJournal(payload);
        await incrementUserJournalCount(scholarUserId);
        await createUserActivity(scholarUserId, "temp-id", src.display_name);
        accepted++;
        console.log(`✅ ${src.display_name} (ISSN ${src.issn_l}) → imported under ScholarBase account`);
      }

      if (!next_cursor) break;
      cursor = next_cursor || "*";
      await new Promise(r => setTimeout(r, 200));
    }

    // ---- Post-run ----
    if (DRY_RUN) {
      console.log(`\n=== DRY-RUN SUMMARY ===`);
      console.log(`Total fetched: ${totalFetched} | Accepted: ${accepted} | Rejected: ${rejected}`);
      if (Object.keys(rejectedReason).length) {
        console.log("Rejection reasons:");
        Object.entries(rejectedReason).forEach(([id, reason]) => console.log(`  ${id}: ${reason}`));
      }
      console.log(`💰 Estimated cost: $${costUsdSpent.spent.toFixed(4)} (${openalexApiKey ? "free key" : "keyless"})`);
      console.log(`📋 Journals would be attributed to user ID: ${scholarUserId}`);
      console.log("   (Use --live to actually import)");
      process.exit(0);
    } else {
      console.log(`\n✅ LIVE HYBRID SEED complete: ${accepted}/${totalFetched} journals imported under your account.`);
      console.log(`💰 Cost so far: $${costUsdSpent.spent.toFixed(4)}`);
      console.log(`👤 Attributed to ScholarBase user ID: ${scholarUserId}`);

      // Purge tri-split tag
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supa = createClient(supabaseUrl, supabaseAnonKey);
        const { error } = await supa.from("tri_split").rpc("revalidate", {
          module: "JOURNAL", tag: "journals-public", expire: 0,
        });
        if (error) console.warn("Tri-split purge:", error.message);
        else console.log("🔁 Tri-split tag journals-public purged.");
      } catch (e) { console.warn("Tri-split purge skipped:", e.message); }

      // DB sizes
      const p2 = new Pool({ connectionString: databaseUrl });
      const { rows } = await p2.query(`
        SELECT pg_size_pretty(pg_relation_size('Journal')) AS heap,
               pg_size_pretty(pg_indexes_size('Journal')) AS indexes,
               pg_size_pretty(pg_total_relation_size('Journal')) AS total`);
      console.log("📊 Journal table sizes:", rows);
      await p2.end();
      process.exit(0);
    }
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
  }
})(); // async IIFE
