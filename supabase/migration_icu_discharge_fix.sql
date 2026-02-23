-- Fix: Add discharge support to icu_queue
-- Run this in your Supabase SQL Editor

-- 1. Add discharged_at column if it doesn't exist
ALTER TABLE icu_queue ADD COLUMN IF NOT EXISTS discharged_at TIMESTAMP WITH TIME ZONE;

-- 2. Update status constraint to include 'discharged'
ALTER TABLE icu_queue DROP CONSTRAINT IF EXISTS icu_queue_status_check;
ALTER TABLE icu_queue ADD CONSTRAINT icu_queue_status_check CHECK (status IN ('waiting', 'admitted', 'assigned', 'cancelled', 'discharged'));
