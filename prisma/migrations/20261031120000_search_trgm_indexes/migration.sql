-- Search indexes for every listing search and both pickers.
--
-- Why this is one migration instead of the old "top-traffic columns first"
-- plan: the list query is a single Prisma `OR` over every declared search
-- field. PostgreSQL can only build a BitmapOr when every branch is indexable,
-- so indexing only some columns would leave the whole OR on a sequential scan.
-- The inventory below mirrors `CONTENT_LIST_CONFIGS` in
-- `src/lib/tri-split/modules/registry.ts`; `test/search/trgm-index-coverage`
-- fails if a search field is added without a matching index here.
--
-- Cost note: GIN trigram indexes are write-amplifying. This box has 2 OCPU,
-- so watch `pg_indexes_size()` after deploy. If a table's write volume grows,
-- drop the trigram indexes for its long free-text columns first, then revisit
-- the query shape (a generated consolidated `search_text` column is the next
-- step, not more per-column indexes).
--
-- `IF NOT EXISTS` matters: the previous Vercel + Supabase deployment may have
-- created the picker indexes by hand (the referenced
-- `20260924110000_optimize_picker_search` migration is not in this repo), and
-- this migration must not fail on an existing index name.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- ---------------------------------------------------------------------------
-- Pickers: exact / prefix lookups that a trigram index cannot serve as well
-- as a B-tree. The raw picker SQL does `LOWER(col) = LOWER(term)` and
-- `LOWER(col) LIKE LOWER(term) || '%'`, so these are expression indexes on
-- the lower-cased value with text_pattern_ops.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "User_handle_lower_prefix_idx"
    ON "public"."User" (LOWER("handle") text_pattern_ops);

CREATE INDEX IF NOT EXISTS "Journal_issn_lower_prefix_idx"
    ON "public"."Journal" (LOWER("issn") text_pattern_ops);

-- ---------------------------------------------------------------------------
-- User: scholar directory, inbox search, scholar picker, and the author
-- relation used by the feed and article searches.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"
    ON "public"."User" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_handle_trgm_idx"
    ON "public"."User" USING gin ("handle" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_bio_trgm_idx"
    ON "public"."User" USING gin ("bio" gin_trgm_ops);

-- Exact expression used by `searchScholarsForPicker`. The expression must
-- match the query byte-for-byte or PostgreSQL will not use the index.
CREATE INDEX IF NOT EXISTS "User_search_text_gin_idx"
    ON "public"."User" USING gin (
        to_tsvector(
            'simple',
            COALESCE("name", '') || ' ' ||
            COALESCE("bio", '') || ' ' ||
            COALESCE("interests", '')
        )
    );

-- ---------------------------------------------------------------------------
-- Journal: journal list, journal picker, and publication-journal linking.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Journal_title_trgm_idx"
    ON "public"."Journal" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Journal_publisher_trgm_idx"
    ON "public"."Journal" USING gin ("publisher" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Journal_about_trgm_idx"
    ON "public"."Journal" USING gin ("about" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Journal_issn_trgm_idx"
    ON "public"."Journal" USING gin ("issn" gin_trgm_ops);

-- Exact expression used by `searchJournalsForPicker`.
CREATE INDEX IF NOT EXISTS "Journal_search_text_gin_idx"
    ON "public"."Journal" USING gin (
        to_tsvector(
            'simple',
            COALESCE("title", '') || ' ' ||
            COALESCE("publisher", '') || ' ' ||
            COALESCE("about", '') || ' ' ||
            COALESCE("subjectArea", '')
        )
    );

-- ---------------------------------------------------------------------------
-- Social feed. The author name/handle branches are covered by the User
-- indexes above.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "SocialPost_content_trgm_idx"
    ON "public"."SocialPost" USING gin ("content" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Articles. The author name branch is covered by User_name_trgm_idx.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Article_title_trgm_idx"
    ON "public"."Article" USING gin ("title" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Help posts.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "HelpPost_title_trgm_idx"
    ON "public"."HelpPost" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "HelpPost_subject_trgm_idx"
    ON "public"."HelpPost" USING gin ("subject" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "HelpPost_message_trgm_idx"
    ON "public"."HelpPost" USING gin ("message" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Contributions.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Contribution_title_trgm_idx"
    ON "public"."Contribution" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Contribution_message_trgm_idx"
    ON "public"."Contribution" USING gin ("message" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Publications.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Publication_title_trgm_idx"
    ON "public"."Publication" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Publication_authors_trgm_idx"
    ON "public"."Publication" USING gin ("authors" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Publication_keywords_trgm_idx"
    ON "public"."Publication" USING gin ("keywords" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Publication_domain_trgm_idx"
    ON "public"."Publication" USING gin ("domain" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Publication_journalOrConference_trgm_idx"
    ON "public"."Publication" USING gin ("journalOrConference" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Publication_abstract_trgm_idx"
    ON "public"."Publication" USING gin ("abstract" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Research tools.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "ResearchTool_name_trgm_idx"
    ON "public"."ResearchTool" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchTool_website_trgm_idx"
    ON "public"."ResearchTool" USING gin ("website" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchTool_use_trgm_idx"
    ON "public"."ResearchTool" USING gin ("use" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchTool_description_trgm_idx"
    ON "public"."ResearchTool" USING gin ("description" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Research grants.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "ResearchGrant_title_trgm_idx"
    ON "public"."ResearchGrant" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchGrant_amount_trgm_idx"
    ON "public"."ResearchGrant" USING gin ("amount" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchGrant_description_trgm_idx"
    ON "public"."ResearchGrant" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchGrant_applyLink_trgm_idx"
    ON "public"."ResearchGrant" USING gin ("applyLink" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchGrant_infoLink_trgm_idx"
    ON "public"."ResearchGrant" USING gin ("infoLink" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Courses.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Course_title_trgm_idx"
    ON "public"."Course" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Course_provider_trgm_idx"
    ON "public"."Course" USING gin ("provider" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Course_instructor_trgm_idx"
    ON "public"."Course" USING gin ("instructor" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Course_format_trgm_idx"
    ON "public"."Course" USING gin ("format" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Course_level_trgm_idx"
    ON "public"."Course" USING gin ("level" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Course_description_trgm_idx"
    ON "public"."Course" USING gin ("description" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Results.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Result_title_trgm_idx"
    ON "public"."Result" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Result_description_trgm_idx"
    ON "public"."Result" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Result_category_trgm_idx"
    ON "public"."Result" USING gin ("category" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Result_conductingBody_trgm_idx"
    ON "public"."Result" USING gin ("conductingBody" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Result_session_trgm_idx"
    ON "public"."Result" USING gin ("session" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Research surveys.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "ResearchSurvey_title_trgm_idx"
    ON "public"."ResearchSurvey" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchSurvey_description_trgm_idx"
    ON "public"."ResearchSurvey" USING gin ("description" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Research events.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "ResearchEvent_title_trgm_idx"
    ON "public"."ResearchEvent" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchEvent_location_trgm_idx"
    ON "public"."ResearchEvent" USING gin ("location" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ResearchEvent_description_trgm_idx"
    ON "public"."ResearchEvent" USING gin ("description" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- PhD admissions.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "PhdAdmission_university_trgm_idx"
    ON "public"."PhdAdmission" USING gin ("university" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "PhdAdmission_department_trgm_idx"
    ON "public"."PhdAdmission" USING gin ("department" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "PhdAdmission_description_trgm_idx"
    ON "public"."PhdAdmission" USING gin ("description" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Job vacancies.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "JobVacancy_title_trgm_idx"
    ON "public"."JobVacancy" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "JobVacancy_institution_trgm_idx"
    ON "public"."JobVacancy" USING gin ("institution" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "JobVacancy_department_trgm_idx"
    ON "public"."JobVacancy" USING gin ("department" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "JobVacancy_subject_trgm_idx"
    ON "public"."JobVacancy" USING gin ("subject" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "JobVacancy_description_trgm_idx"
    ON "public"."JobVacancy" USING gin ("description" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Supervisors.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Supervisor_name_trgm_idx"
    ON "public"."Supervisor" USING gin ("name" gin_trgm_ops);
