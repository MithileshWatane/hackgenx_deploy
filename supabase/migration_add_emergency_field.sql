-- Migration: Add is_emergency field to appointments table
-- This allows marking appointments as emergency cases that should skip OPD queue

-- Add is_emergency column to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_is_emergency ON appointments(is_emergency);

-- Add comment for documentation
COMMENT ON COLUMN appointments.is_emergency IS 'Indicates if this is an emergency appointment that should bypass OPD queue and go directly to ICU queue';
