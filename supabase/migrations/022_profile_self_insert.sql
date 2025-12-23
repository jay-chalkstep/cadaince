-- Migration 022: Allow users to insert their own profile + user preferences
-- This enables the /api/users/me endpoint to auto-provision profiles
-- without using the service role key (which bypasses RLS).

-- ============================================
-- ADD USER PREFERENCE COLUMNS
-- ============================================
-- These columns support the /api/users/me PATCH endpoint.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';

-- ============================================
-- ALLOW SELF-INSERT ON PROFILES
-- ============================================
-- Users can insert a profile row where clerk_id matches their JWT sub claim.
-- This is needed for auto-provisioning new users on their first /me request.

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (clerk_id = auth.jwt() ->> 'sub');

-- ============================================
-- ALLOW EMAIL-BASED PROFILE LINKING
-- ============================================
-- When a user signs up with an email that already has an invited profile,
-- we need to allow them to update that profile to link their clerk_id.
-- This extends the existing "Users can update own profile" policy.

-- Note: The existing policy only allows updates where clerk_id matches.
-- For linking, we need to also allow updates where the profile has no clerk_id
-- but the email matches the user's Clerk email. However, since we can't get
-- the user's email from the JWT reliably in RLS, we'll handle this specific
-- case by using the admin client only for the linking operation.
-- All other /me operations use the authenticated client.
