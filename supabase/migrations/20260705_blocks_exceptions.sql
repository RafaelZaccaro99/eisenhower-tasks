-- Fase 1 — exceções de recorrência em blocos da agenda.
-- Datas puladas de uma série recorrente (padrão iCal EXDATE).
-- Formato: ["2026-07-10", "2026-07-17", ...]
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS recurrence_exceptions jsonb NOT NULL DEFAULT '[]';
