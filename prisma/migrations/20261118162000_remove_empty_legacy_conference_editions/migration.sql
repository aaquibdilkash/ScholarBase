-- Remove only empty compatibility occurrences created during the edition
-- rollout. Any row referenced by a manuscript remains for provenance.
DELETE FROM "public"."ConferenceEdition" e
WHERE e."label" ~ '[[:space:]]—[[:space:]]legacy proceedings$'
  AND NOT EXISTS (
    SELECT 1 FROM "public"."Manuscript" m WHERE m."editionId" = e."id"
  );
