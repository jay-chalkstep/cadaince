-- reMarkable Integration Tables
-- User-level integration for pushing documents to reMarkable tablets

-- Documents pushed to reMarkable
CREATE TABLE IF NOT EXISTS remarkable_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  remarkable_doc_id TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN ('meeting_agenda', 'briefing', 'rock_list')),
  source_id UUID, -- Reference to l10_meetings.id, briefings.id, etc.
  title TEXT NOT NULL,
  pushed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pushed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding documents by source
CREATE INDEX IF NOT EXISTS idx_remarkable_documents_source ON remarkable_documents(document_type, source_id);
CREATE INDEX IF NOT EXISTS idx_remarkable_documents_profile ON remarkable_documents(profile_id);

-- Auto-push preferences per user
CREATE TABLE IF NOT EXISTS remarkable_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) NOT NULL UNIQUE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  push_meeting_agendas BOOLEAN DEFAULT true,
  push_briefings BOOLEAN DEFAULT false,
  minutes_before_meeting INTEGER DEFAULT 60,
  folder_path TEXT DEFAULT '/Aicomplice',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for remarkable_documents
ALTER TABLE remarkable_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own remarkable documents"
  ON remarkable_documents FOR SELECT
  USING (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own remarkable documents"
  ON remarkable_documents FOR INSERT
  WITH CHECK (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update own remarkable documents"
  ON remarkable_documents FOR UPDATE
  USING (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  )
  WITH CHECK (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own remarkable documents"
  ON remarkable_documents FOR DELETE
  USING (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

-- RLS for remarkable_settings
ALTER TABLE remarkable_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own remarkable settings"
  ON remarkable_settings FOR SELECT
  USING (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own remarkable settings"
  ON remarkable_settings FOR INSERT
  WITH CHECK (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update own remarkable settings"
  ON remarkable_settings FOR UPDATE
  USING (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  )
  WITH CHECK (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own remarkable settings"
  ON remarkable_settings FOR DELETE
  USING (
    profile_id = (
      SELECT id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );
