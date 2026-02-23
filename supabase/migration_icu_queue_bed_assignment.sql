-- Migration: Add bed assignment columns to icu_queue
-- Run this in your Supabase SQL editor

-- Add assignment tracking columns to icu_queue (with robust type handling)
-- 1. Ensure columns exist
ALTER TABLE icu_queue ADD COLUMN IF NOT EXISTS assigned_bed_id TEXT;
ALTER TABLE icu_queue ADD COLUMN IF NOT EXISTS assigned_bed_label TEXT;
ALTER TABLE icu_queue ADD COLUMN IF NOT EXISTS admission_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE icu_queue ADD COLUMN IF NOT EXISTS discharge_time TIMESTAMP WITH TIME ZONE;

-- 2. Force type to TEXT in case it was created as INTEGER previously (for UUID support)
ALTER TABLE icu_queue ALTER COLUMN assigned_bed_id TYPE TEXT;

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_icu_queue_assigned_bed_id ON icu_queue(assigned_bed_id);

-- 4. Update status constraint to include 'assigned'
ALTER TABLE icu_queue DROP CONSTRAINT IF EXISTS icu_queue_status_check;
ALTER TABLE icu_queue ADD CONSTRAINT icu_queue_status_check CHECK (status IN ('waiting', 'admitted', 'assigned', 'cancelled'));
