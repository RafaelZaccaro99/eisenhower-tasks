-- Comprehensive RLS fix — run in Supabase SQL Editor
-- Safe to run multiple times (idempotent).
--
-- Root cause fixed: the set_user_id() trigger used SECURITY DEFINER,
-- which causes auth.uid() to return NULL inside the trigger.
-- This overwrote the explicit user_id sent by the server, making every
-- INSERT fail the RLS policy "auth.uid() = user_id".
--
-- Fix: drop the triggers entirely. Server code (api/*.js) already sets
-- user_id explicitly by decoding the JWT — no trigger needed.

-- 1. Drop broken triggers and function
DROP TRIGGER IF EXISTS set_user_id_tasks  ON tasks;
DROP TRIGGER IF EXISTS set_user_id_people ON people;
DROP TRIGGER IF EXISTS set_user_id_blocks ON blocks;
DROP FUNCTION IF EXISTS set_user_id();

-- 2. Add user_id columns (no-op if auth_migration.sql already ran)
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE;

-- 3. Back-fill existing rows that have user_id = NULL
UPDATE tasks  SET user_id = (SELECT id FROM auth.users WHERE email = 'rafaelfernandozaccaro@gmail.com') WHERE user_id IS NULL;
UPDATE people SET user_id = (SELECT id FROM auth.users WHERE email = 'rafaelfernandozaccaro@gmail.com') WHERE user_id IS NULL;
UPDATE blocks SET user_id = (SELECT id FROM auth.users WHERE email = 'rafaelfernandozaccaro@gmail.com') WHERE user_id IS NULL;

-- 4. Ensure RLS is on
ALTER TABLE tasks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- 5. Recreate policies cleanly
DROP POLICY IF EXISTS "public access" ON tasks;
DROP POLICY IF EXISTS "public access" ON people;
DROP POLICY IF EXISTS "public access" ON blocks;
DROP POLICY IF EXISTS "user access"   ON tasks;
DROP POLICY IF EXISTS "user access"   ON people;
DROP POLICY IF EXISTS "user access"   ON blocks;

CREATE POLICY "user access" ON tasks  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user access" ON people FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user access" ON blocks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
