-- Cover image for the Scholar Suggest post, following the blog article's
-- pattern. The URL points at a public Supabase Storage object.
ALTER TABLE "HelpPost"
ADD COLUMN "imageUrl" TEXT;
