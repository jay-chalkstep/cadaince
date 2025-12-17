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
  ('00000000-0000-0000-0001-000000000001', '', 'jay@choicedigital.com', 'Jay', 'CEO', '00000000-0000-0000-0000-000000000001', 'admin', true),
  ('00000000-0000-0000-0001-000000000002', '', 'martae@choicedigital.com', 'Martae', 'Chief of Staff', '00000000-0000-0000-0000-000000000001', 'admin', true),
  ('00000000-0000-0000-0001-000000000003', '', 'theresa@choicedigital.com', 'Theresa', 'Chief Growth Officer', '00000000-0000-0000-0000-000000000002', 'elt', true),
  ('00000000-0000-0000-0001-000000000004', '', 'judd@choicedigital.com', 'Judd', 'Chief Customer Officer', '00000000-0000-0000-0000-000000000003', 'elt', true),
  ('00000000-0000-0000-0001-000000000005', '', 'chad@choicedigital.com', 'Chad', 'COO', '00000000-0000-0000-0000-000000000005', 'elt', true),
  ('00000000-0000-0000-0001-000000000006', '', 'mike@choicedigital.com', 'Mike', 'Chief Product Officer', '00000000-0000-0000-0000-000000000004', 'elt', true),
  ('00000000-0000-0000-0001-000000000007', '', 'nanda@choicedigital.com', 'Nanda', 'Head of Engineering', '00000000-0000-0000-0000-000000000004', 'slt', false),
  ('00000000-0000-0000-0001-000000000008', '', 'brooke@choicedigital.com', 'Brooke', 'Head of Product', '00000000-0000-0000-0000-000000000004', 'slt', false),
  ('00000000-0000-0000-0001-000000000009', '', 'brian@choicedigital.com', 'Brian', 'VP Operations', '00000000-0000-0000-0000-000000000005', 'slt', false),
  ('00000000-0000-0000-0001-000000000010', '', 'evan@choicedigital.com', 'Evan', 'Head of People', '00000000-0000-0000-0000-000000000007', 'slt', false),
  ('00000000-0000-0000-0001-000000000011', '', 'luke@choicedigital.com', 'Luke', 'Controller', '00000000-0000-0000-0000-000000000006', 'slt', false),
  ('00000000-0000-0000-0001-000000000012', '', 'stefanie@choicedigital.com', 'Stefanie', 'Executive Assistant', '00000000-0000-0000-0000-000000000001', 'consumer', false);

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
