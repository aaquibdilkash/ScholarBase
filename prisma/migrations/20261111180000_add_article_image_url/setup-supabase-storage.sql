-- ============================================================================
-- ScholarBase content images — Supabase Storage setup
--
-- Run this in the Supabase SQL Editor. It is idempotent AND self-updating:
-- every policy is dropped and recreated, so re-running after a change to the
-- path layout (or to a policy's conditions) always applies the current
-- definition. A plain "CREATE POLICY IF NOT EXISTS" would silently keep a
-- stale policy and the app would fail with a row-level security error.
--
-- Path structure:
--   Draft:     users/{userId}/drafts/{kind}/{uuid}/{fileName}
--   Published: users/{userId}/published/{kind}/{uuid}/{fileName}
--
-- where kind is module-scoped ("article-cover", "cfp-cover", "position-cover",
-- "admission-cover", "article-inline", ...).
--
-- Isolation comes from folder[2] (the owner) and folder[3] (drafts vs
-- published). The kind segment is NOT allow-listed, so a new content module
-- can add its own kind without editing this file.
-- ============================================================================

-- Create the bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policies (drop + recreate so re-running applies the current definition)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can upload to their own draft folder" ON storage.objects;
CREATE POLICY "Users can upload to their own draft folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'blog-images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'drafts'
);

DROP POLICY IF EXISTS "Users can read their own draft images" ON storage.objects;
CREATE POLICY "Users can read their own draft images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'blog-images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'drafts'
);

DROP POLICY IF EXISTS "Users can update their own draft images" ON storage.objects;
CREATE POLICY "Users can update their own draft images" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'blog-images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'drafts'
)
WITH CHECK (
  bucket_id = 'blog-images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'drafts'
);

DROP POLICY IF EXISTS "Users can delete their own draft images" ON storage.objects;
CREATE POLICY "Users can delete their own draft images" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'blog-images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'drafts'
);

-- Publishing copies a draft into the published folder, so the owner needs
-- INSERT there too.
DROP POLICY IF EXISTS "Users can publish drafts to published folder" ON storage.objects;
CREATE POLICY "Users can publish drafts to published folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'blog-images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'published'
);

-- Replacing a cover image deletes the owner's OWN published object, so the
-- owner needs DELETE there too. The paths always come from the content's own
-- stored row, never from the submitted form.
DROP POLICY IF EXISTS "Users can delete their own published images" ON storage.objects;
CREATE POLICY "Users can delete their own published images" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'blog-images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'published'
);

-- Published images are readable by anyone (the bucket is public).
DROP POLICY IF EXISTS "Public can read published images" ON storage.objects;
CREATE POLICY "Public can read published images" ON storage.objects
FOR SELECT TO public
USING (
  bucket_id = 'blog-images'
  AND (storage.foldername(name))[3] = 'published'
);

-- The service role bypasses RLS entirely; this policy is the explicit
-- statement of that for the Storage API.
DROP POLICY IF EXISTS "Service role can manage blog images" ON storage.objects;
CREATE POLICY "Service role can manage blog images" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'blog-images')
WITH CHECK (bucket_id = 'blog-images');
