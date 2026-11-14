-- Supervisors are searched by institution, not just by the professor's name:
-- a new PhD applicant typically knows the university (Jamia, IIT, ISM) before
-- they know who supervises there. Both new search branches need a trigram GIN
-- index so PostgreSQL can build a BitmapOr for the whole module; without them
-- the combined OR degrades to a sequential scan.
--
-- `pg_trgm` is created by 20261031120000_search_trgm_indexes.

CREATE INDEX IF NOT EXISTS "Supervisor_university_trgm_idx"
    ON "public"."Supervisor" USING gin ("university" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Supervisor_department_trgm_idx"
    ON "public"."Supervisor" USING gin ("department" gin_trgm_ops);
