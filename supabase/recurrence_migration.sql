-- Recurrence migration — run in Supabase SQL Editor AFTER auth_migration.sql
-- Adds recurrence support to tasks

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence      text;  -- 'daily' | 'weekly' | 'monthly' | null
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_end  date;  -- stop creating instances after this date
