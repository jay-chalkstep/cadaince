-- Aicomplice Database Schema
-- Migration 018: Headlines (L10 Good News Sharing)

-- ============================================
-- 1. HEADLINES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS headlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  headline_type TEXT CHECK (headline_type IN ('customer', 'employee', 'general')) DEFAULT 'general',

  -- Attribution
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentioned_member_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Employee being recognized

  -- Meeting context
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL, -- Shared in which L10
  shared_at TIMESTAMPTZ,                                       -- When shared in meeting

  -- Reactions (stored as {"emoji": ["user_id_1", "user_id_2"]})
  reactions JSONB DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_headlines_organization ON headlines(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_headlines_meeting ON headlines(meeting_id);
CREATE INDEX IF NOT EXISTS idx_headlines_created_by ON headlines(created_by);
CREATE INDEX IF NOT EXISTS idx_headlines_mentioned ON headlines(mentioned_member_id);
CREATE INDEX IF NOT EXISTS idx_headlines_type ON headlines(headline_type);

-- ============================================
-- 3. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE headlines ENABLE ROW LEVEL SECURITY;

-- Users can view headlines in their org
CREATE POLICY "Users can view own org headlines"
ON headlines FOR SELECT
USING (organization_id = get_current_organization_id());

-- Users can create headlines in their org
CREATE POLICY "Users can create headlines in org"
ON headlines FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_id()
  AND created_by = get_current_profile_id()
);

-- Users can update their own headlines (for reactions)
CREATE POLICY "Users can update own headlines"
ON headlines FOR UPDATE
USING (
  organization_id = get_current_organization_id()
  AND created_by = get_current_profile_id()
);

-- Allow anyone in org to update reactions
CREATE POLICY "Users can react to headlines"
ON headlines FOR UPDATE
USING (organization_id = get_current_organization_id())
WITH CHECK (organization_id = get_current_organization_id());

-- Users can delete their own headlines
CREATE POLICY "Users can delete own headlines"
ON headlines FOR DELETE
USING (
  organization_id = get_current_organization_id()
  AND created_by = get_current_profile_id()
);

-- Admins can manage all headlines
CREATE POLICY "Admins can manage all org headlines"
ON headlines FOR ALL
USING (
  organization_id = get_current_organization_id()
  AND get_current_access_level() = 'admin'
);

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Add reaction to headline
CREATE OR REPLACE FUNCTION add_headline_reaction(
  p_headline_id UUID,
  p_emoji TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_reactions JSONB;
  v_users JSONB;
BEGIN
  -- Get current reactions
  SELECT reactions INTO v_reactions
  FROM headlines
  WHERE id = p_headline_id;

  -- Get current users for this emoji
  v_users := COALESCE(v_reactions->p_emoji, '[]'::jsonb);

  -- Check if user already reacted with this emoji
  IF v_users ? p_user_id::text THEN
    -- Remove the reaction (toggle off)
    v_users := v_users - p_user_id::text;
  ELSE
    -- Add the reaction
    v_users := v_users || to_jsonb(p_user_id::text);
  END IF;

  -- Update reactions
  IF jsonb_array_length(v_users) = 0 THEN
    v_reactions := v_reactions - p_emoji;
  ELSE
    v_reactions := jsonb_set(COALESCE(v_reactions, '{}'::jsonb), ARRAY[p_emoji], v_users);
  END IF;

  -- Save and return
  UPDATE headlines
  SET reactions = v_reactions
  WHERE id = p_headline_id;

  RETURN v_reactions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get headlines with enriched data
CREATE OR REPLACE FUNCTION get_headlines_enriched(
  p_organization_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_meeting_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  headline_type TEXT,
  created_by JSONB,
  mentioned_member JSONB,
  meeting_id UUID,
  shared_at TIMESTAMPTZ,
  reactions JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.title,
    h.description,
    h.headline_type,
    jsonb_build_object(
      'id', cb.id,
      'full_name', cb.full_name,
      'avatar_url', cb.avatar_url
    ) as created_by,
    CASE WHEN mm.id IS NOT NULL THEN
      jsonb_build_object(
        'id', mm.id,
        'full_name', mm.full_name,
        'avatar_url', mm.avatar_url
      )
    ELSE NULL END as mentioned_member,
    h.meeting_id,
    h.shared_at,
    h.reactions,
    h.created_at
  FROM headlines h
  JOIN profiles cb ON h.created_by = cb.id
  LEFT JOIN profiles mm ON h.mentioned_member_id = mm.id
  WHERE h.organization_id = p_organization_id
    AND (p_meeting_id IS NULL OR h.meeting_id = p_meeting_id)
  ORDER BY h.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
