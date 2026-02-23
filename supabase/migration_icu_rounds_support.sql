-- Migration: Securely add ICU support to Daily Rounds, Medical Reports, and Discharge Predictions
-- This maintains strict foreign key integrity by adding dedicated ICU columns instead of dropping constraints.

-- 1. Update daily_rounds
ALTER TABLE daily_rounds ALTER COLUMN bed_queue_id DROP NOT NULL;
ALTER TABLE daily_rounds ADD COLUMN IF NOT EXISTS icu_queue_id UUID REFERENCES icu_queue(id) ON DELETE CASCADE;
ALTER TABLE daily_rounds ADD COLUMN IF NOT EXISTS icu_bed_id UUID REFERENCES icu_beds(id) ON DELETE SET NULL;

-- 2. Update medical_reports
ALTER TABLE medical_reports ALTER COLUMN bed_queue_id DROP NOT NULL;
ALTER TABLE medical_reports ADD COLUMN IF NOT EXISTS icu_queue_id UUID REFERENCES icu_queue(id) ON DELETE CASCADE;

-- 3. Update discharge_predictions
ALTER TABLE discharge_predictions ALTER COLUMN bed_queue_id DROP NOT NULL;
ALTER TABLE discharge_predictions ADD COLUMN IF NOT EXISTS icu_queue_id UUID REFERENCES icu_queue(id) ON DELETE CASCADE;

-- 4. Add CHECK constraints to ensure exactly one queue reference (General or ICU) is used
ALTER TABLE daily_rounds DROP CONSTRAINT IF EXISTS check_queue_source;
ALTER TABLE daily_rounds ADD CONSTRAINT check_queue_source 
    CHECK ((bed_queue_id IS NOT NULL AND icu_queue_id IS NULL) OR (bed_queue_id IS NULL AND icu_queue_id IS NOT NULL));

ALTER TABLE medical_reports DROP CONSTRAINT IF EXISTS check_queue_source_reports;
ALTER TABLE medical_reports ADD CONSTRAINT check_queue_source_reports 
    CHECK ((bed_queue_id IS NOT NULL AND icu_queue_id IS NULL) OR (bed_queue_id IS NULL AND icu_queue_id IS NOT NULL));

ALTER TABLE discharge_predictions DROP CONSTRAINT IF EXISTS check_queue_source_predictions;
ALTER TABLE discharge_predictions ADD CONSTRAINT check_queue_source_predictions 
    CHECK ((bed_queue_id IS NOT NULL AND icu_queue_id IS NULL) OR (bed_queue_id IS NULL AND icu_queue_id IS NOT NULL));

-- 4.5 Add Unique Constraint for ICU Upserts
ALTER TABLE discharge_predictions DROP CONSTRAINT IF EXISTS discharge_predictions_icu_queue_id_round_id_key;
ALTER TABLE discharge_predictions ADD CONSTRAINT discharge_predictions_icu_queue_id_round_id_key UNIQUE (icu_queue_id, round_id);

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_rounds_icu_queue_id ON daily_rounds(icu_queue_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_icu_queue_id ON medical_reports(icu_queue_id);
CREATE INDEX IF NOT EXISTS idx_discharge_predictions_icu_queue_id ON discharge_predictions(icu_queue_id);
