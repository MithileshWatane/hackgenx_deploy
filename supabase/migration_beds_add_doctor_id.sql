-- Migration: Add doctor_id to beds table
-- This allows filtering beds by the doctor who created them

ALTER TABLE beds ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_beds_doctor_id ON beds(doctor_id);

-- Update RLS policy to allow doctors to only see their own beds
DROP POLICY IF EXISTS "Allow authenticated users full access on beds" ON beds;
CREATE POLICY "Allow doctors to see their own beds" ON beds
  FOR ALL TO authenticated 
  USING (doctor_id = auth.uid() OR doctor_id IS NULL) 
  WITH CHECK (doctor_id = auth.uid());
