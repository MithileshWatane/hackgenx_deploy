-- Migration: Sync Discharge Time Support
-- Adds discharge_time column to bed_queue to match icu_queue
-- This allows the AI prediction system to store and display predicted dates consistently.

-- 1. Add discharge_time to bed_queue
ALTER TABLE bed_queue ADD COLUMN IF NOT EXISTS discharge_time TIMESTAMP WITH TIME ZONE;

-- 2. Add discharge_time to icu_queue (already exists, but for safety)
ALTER TABLE icu_queue ADD COLUMN IF NOT EXISTS discharge_time TIMESTAMP WITH TIME ZONE;
