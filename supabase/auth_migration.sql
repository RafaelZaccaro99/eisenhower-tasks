-- Auth migration — run in Supabase SQL Editor AFTER schema.sql
-- Adds user_id to all tables, updates RLS to per-user isolation

-- 1. Add user_id columns
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE CASCADE;

-- 2. Function + triggers to auto-set user_id on insert
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_id_tasks  ON tasks;
DROP TRIGGER IF EXISTS set_user_id_people ON people;
DROP TRIGGER IF EXISTS set_user_id_blocks ON blocks;

CREATE TRIGGER set_user_id_tasks  BEFORE INSERT ON tasks  FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER set_user_id_people BEFORE INSERT ON people FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER set_user_id_blocks BEFORE INSERT ON blocks FOR EACH ROW EXECUTE FUNCTION set_user_id();

-- 3. Replace public policies with per-user policies
DROP POLICY IF EXISTS "public access" ON tasks;
DROP POLICY IF EXISTS "public access" ON people;
DROP POLICY IF EXISTS "public access" ON blocks;

CREATE POLICY "user access" ON tasks  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user access" ON people FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user access" ON blocks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
