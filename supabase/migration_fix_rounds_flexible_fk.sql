-- Migration: Relax Foreign Key constraints for Daily Rounds, Medical Reports, and Discharge Predictions
-- This allows these tables to store references to both 'bed_queue' and 'icu_queue' patient stays.

-- 1. Relax daily_rounds
ALTER TABLE daily_rounds DROP CONSTRAINT IF EXISTS daily_rounds_bed_queue_id_fkey;
ALTER TABLE daily_rounds DROP CONSTRAINT IF EXISTS daily_rounds_bed_id_fkey;

-- 2. Relax medical_reports
ALTER TABLE medical_reports DROP CONSTRAINT IF EXISTS medical_reports_bed_queue_id_fkey;

-- 3. Relax discharge_predictions
ALTER TABLE discharge_predictions DROP CONSTRAINT IF EXISTS discharge_predictions_bed_queue_id_fkey;

-- Note: We keep the references to Daily Rounds where applicable as those are internal to these three tables.
