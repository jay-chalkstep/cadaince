-- Migration: 021_comments.sql
-- Comments + @Mentions system
-- Async conversation attached to any entity. Context stays with the thing.

-- Comments table (polymorphic attachment)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Polymorphic attachment (what is this comment on?)
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'rock', 'todo', 'issue', 'metric', 'milestone', 'headline', 'process', 'vto'
  )),
  entity_id UUID NOT NULL,

  -- Content
  body TEXT NOT NULL,                    -- Markdown supported

  -- Author
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Metadata
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,                -- Soft delete

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id, created_at);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_org ON comments(organization_id, created_at DESC);
CREATE INDEX idx_comments_deleted ON comments(deleted_at) WHERE deleted_at IS NULL;

-- Mentions extracted from comments (for fast lookup)
CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Read status
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mentions_user ON mentions(mentioned_id, read_at);
CREATE INDEX idx_mentions_user_unread ON mentions(mentioned_id) WHERE read_at IS NULL;
CREATE INDEX idx_mentions_comment ON mentions(comment_id);

-- RLS Policies for comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments in their organization
CREATE POLICY "Users can view org comments"
ON comments FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
);

-- Users can create comments in their organization
CREATE POLICY "Users can create comments"
ON comments FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
  AND author_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON comments FOR UPDATE
USING (
  author_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
)
WITH CHECK (
  author_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
);

-- Users can delete (soft) their own comments
CREATE POLICY "Users can delete own comments"
ON comments FOR DELETE
USING (
  author_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
);

-- RLS Policies for mentions
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;

-- Users can view mentions in their organization (via comment)
CREATE POLICY "Users can view org mentions"
ON mentions FOR SELECT
USING (
  comment_id IN (
    SELECT c.id FROM comments c
    WHERE c.organization_id IN (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text
    )
  )
);

-- Users can create mentions (system creates on comment save)
CREATE POLICY "Users can create mentions"
ON mentions FOR INSERT
WITH CHECK (
  comment_id IN (
    SELECT c.id FROM comments c
    WHERE c.organization_id IN (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text
    )
  )
);

-- Users can update their own mentions (mark as read)
CREATE POLICY "Users can update own mentions"
ON mentions FOR UPDATE
USING (
  mentioned_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
)
WITH CHECK (
  mentioned_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
);
