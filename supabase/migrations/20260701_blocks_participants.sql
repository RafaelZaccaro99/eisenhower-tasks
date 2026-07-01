-- Add participants to blocks (array of person IDs stored as JSONB)
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS participants jsonb NOT NULL DEFAULT '[]';
