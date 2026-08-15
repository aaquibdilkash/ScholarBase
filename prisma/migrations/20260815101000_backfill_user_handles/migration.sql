UPDATE "User"
SET "handle" = 'scholar_' || replace("id", '-', '')
WHERE "handle" IS NULL;
