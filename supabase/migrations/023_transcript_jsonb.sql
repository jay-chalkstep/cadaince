-- Migration: Add transcript_data JSONB column for word-level timestamps
-- Enables clickable transcript seeking in video updates

-- Enable pg_trgm extension for text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add JSONB column for structured transcript with word-level timestamps
-- Structure: { "text": "full transcript", "words": [{ "word": "Hello", "start": 0.0, "end": 0.5 }, ...] }
ALTER TABLE updates
ADD COLUMN IF NOT EXISTS transcript_data JSONB;

-- Add comment for documentation
COMMENT ON COLUMN updates.transcript_data IS 'Structured transcript with word-level timestamps for video seeking. Contains text (full transcript) and words array with start/end times in seconds.';

-- Create index for faster text search within transcript_data
CREATE INDEX IF NOT EXISTS idx_updates_transcript_data_text
ON updates USING GIN ((transcript_data->>'text') gin_trgm_ops);

-- Note: Keep existing 'transcript' text column for backward compatibility
-- New videos will populate both columns; transcript_data is preferred when available
