-- Migration: Video Storage Bucket
-- Creates Supabase storage bucket for video updates (replacing Mux)

-- Create the bucket for update videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'update-videos',
  'update-videos',
  true,
  52428800, -- 50MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload videos to their own folder
CREATE POLICY "Users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'update-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Anyone authenticated can view videos (org isolation handled at app level)
CREATE POLICY "Videos are viewable by authenticated users"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'update-videos');

-- Policy: Users can delete their own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'update-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
