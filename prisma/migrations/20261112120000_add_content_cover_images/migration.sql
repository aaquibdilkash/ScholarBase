-- Cover images for the modules that gained an `imageUrl` column, following the
-- blog article's pattern. The URL points at a public Supabase Storage object.
ALTER TABLE "CallForPaper"
ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "Admission"
ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "AcademicPosition"
ADD COLUMN "imageUrl" TEXT;
