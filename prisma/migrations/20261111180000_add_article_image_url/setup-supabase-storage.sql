-- Create the blog-images bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Path structure:
--   Draft:   users/{userId}/drafts/{kind}/{uuid}/{fileName}
--   Published: users/{userId}/published/{kind}/{fileName}
-- where kind is "cover" or "inline"

-- Helper: create policy only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload to their own draft folder'
  ) THEN
    CREATE POLICY "Users can upload to their own draft folder" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'blog-images'
      AND (storage.foldername(name))[1] = 'users'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[3] = 'drafts'
      AND (storage.foldername(name))[4] IN ('cover', 'inline')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can read their own draft images'
  ) THEN
    CREATE POLICY "Users can read their own draft images" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'blog-images'
      AND (storage.foldername(name))[1] = 'users'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[3] = 'drafts'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update their own draft images'
  ) THEN
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
      AND (storage.foldername(name))[4] IN ('cover', 'inline')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete their own draft images'
  ) THEN
    CREATE POLICY "Users can delete their own draft images" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'blog-images'
      AND (storage.foldername(name))[1] = 'users'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[3] = 'drafts'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can publish drafts to published folder'
  ) THEN
    CREATE POLICY "Users can publish drafts to published folder" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'blog-images'
      AND (storage.foldername(name))[1] = 'users'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[3] = 'published'
      AND (storage.foldername(name))[4] IN ('cover', 'inline')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public can read published images'
  ) THEN
    CREATE POLICY "Public can read published images" ON storage.objects
    FOR SELECT TO public
    USING (
      bucket_id = 'blog-images'
      AND (storage.foldername(name))[3] = 'published'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Service role can manage blog images'
  ) THEN
    CREATE POLICY "Service role can manage blog images" ON storage.objects
    FOR ALL TO service_role
    USING (bucket_id = 'blog-images')
    WITH CHECK (bucket_id = 'blog-images');
  END IF;
END $$;
