-- Migration: Add doctor_id to icu_beds table
-- This allows filtering ICU beds by the doctor who created them

ALTER TABLE icu_beds ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_icu_beds_doctor_id ON icu_beds(doctor_id);

-- Update RLS policy to allow doctors to only see their own ICU beds
DROP POLICY IF EXISTS "Allow authenticated users full access on icu_beds" ON icu_beds;
CREATE POLICY "Allow doctors to see their own ICU beds" ON icu_beds
  FOR ALL TO authenticated 
  USING (doctor_id = auth.uid() OR doctor_id IS NULL) 
  WITH CHECK (doctor_id = auth.uid());
