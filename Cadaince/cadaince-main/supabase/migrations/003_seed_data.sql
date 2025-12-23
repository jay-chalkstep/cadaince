-- Cadence Seed Data
-- Initial data for Choice Digital team

-- ============================================
-- PILLARS
-- ============================================
insert into pillars (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Executive'),
  ('00000000-0000-0000-0000-000000000002', 'Growth'),
  ('00000000-0000-0000-0000-000000000003', 'Customer'),
  ('00000000-0000-0000-0000-000000000004', 'Product'),
  ('00000000-0000-0000-0000-000000000005', 'Operations'),
  ('00000000-0000-0000-0000-000000000006', 'Finance'),
  ('00000000-0000-0000-0000-000000000007', 'People');

-- ============================================
-- PROFILES
-- Note: clerk_id will be populated when users first sign in via webhook
-- These are placeholder profiles that will be matched by email
-- ============================================
insert into profiles (id, clerk_id, email, full_name, role, pillar_id, access_level, is_elt) values
  ('00000000-0000-0000-0001-000000000001', 'pending_jay', 'jay@choicedigital.com', 'Jay', 'CEO', '00000000-0000-0000-0000-000000000001', 'admin', true),
  ('00000000-0000-0000-0001-000000000002', 'pending_martae', 'martae@choicedigital.com', 'Martae', 'Chief of Staff', '00000000-0000-0000-0000-000000000001', 'admin', true),
  ('00000000-0000-0000-0001-000000000003', 'pending_theresa', 'theresa@choicedigital.com', 'Theresa', 'Chief Growth Officer', '00000000-0000-0000-0000-000000000002', 'elt', true),
  ('00000000-0000-0000-0001-000000000004', 'pending_judd', 'judd@choicedigital.com', 'Judd', 'Chief Customer Officer', '00000000-0000-0000-0000-000000000003', 'elt', true),
  ('00000000-0000-0000-0001-000000000005', 'pending_chad', 'chad@choicedigital.com', 'Chad', 'COO', '00000000-0000-0000-0000-000000000005', 'elt', true),
  ('00000000-0000-0000-0001-000000000006', 'pending_mike', 'mike@choicedigital.com', 'Mike', 'Chief Product Officer', '00000000-0000-0000-0000-000000000004', 'elt', true),
  ('00000000-0000-0000-0001-000000000007', 'pending_nanda', 'nanda@choicedigital.com', 'Nanda', 'Head of Engineering', '00000000-0000-0000-0000-000000000004', 'slt', false),
  ('00000000-0000-0000-0001-000000000008', 'pending_brooke', 'brooke@choicedigital.com', 'Brooke', 'Head of Product', '00000000-0000-0000-0000-000000000004', 'slt', false),
  ('00000000-0000-0000-0001-000000000009', 'pending_brian', 'brian@choicedigital.com', 'Brian', 'VP Operations', '00000000-0000-0000-0000-000000000005', 'slt', false),
  ('00000000-0000-0000-0001-000000000010', 'pending_evan', 'evan@choicedigital.com', 'Evan', 'Head of People', '00000000-0000-0000-0000-000000000007', 'slt', false),
  ('00000000-0000-0000-0001-000000000011', 'pending_luke', 'luke@choicedigital.com', 'Luke', 'Controller', '00000000-0000-0000-0000-000000000006', 'slt', false),
  ('00000000-0000-0000-0001-000000000012', 'pending_stefanie', 'stefanie@choicedigital.com', 'Stefanie', 'Executive Assistant', '00000000-0000-0000-0000-000000000001', 'consumer', false);

-- ============================================
-- UPDATE PILLAR LEADERS
-- ============================================
update pillars set leader_id = '00000000-0000-0000-0001-000000000001' where id = '00000000-0000-0000-0000-000000000001'; -- Executive -> Jay
update pillars set leader_id = '00000000-0000-0000-0001-000000000003' where id = '00000000-0000-0000-0000-000000000002'; -- Growth -> Theresa
update pillars set leader_id = '00000000-0000-0000-0001-000000000004' where id = '00000000-0000-0000-0000-000000000003'; -- Customer -> Judd
update pillars set leader_id = '00000000-0000-0000-0001-000000000006' where id = '00000000-0000-0000-0000-000000000004'; -- Product -> Mike
update pillars set leader_id = '00000000-0000-0000-0001-000000000005' where id = '00000000-0000-0000-0000-000000000005'; -- Operations -> Chad
update pillars set leader_id = '00000000-0000-0000-0001-000000000011' where id = '00000000-0000-0000-0000-000000000006'; -- Finance -> Luke
update pillars set leader_id = '00000000-0000-0000-0001-000000000010' where id = '00000000-0000-0000-0000-000000000007'; -- People -> Evan
