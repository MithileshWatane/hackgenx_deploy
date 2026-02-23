-- Migration: ICU Queue Table
-- This table tracks patients shifted from general beds to the ICU

CREATE TABLE IF NOT EXISTS icu_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_token TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  diseases TEXT NOT NULL,
  surgery_type TEXT,
  bed_type TEXT DEFAULT 'icu',
  severity TEXT,
  is_emergency BOOLEAN DEFAULT false,
  predicted_stay_days INTEGER,
  ventilator_needed BOOLEAN DEFAULT false,
  dialysis_needed BOOLEAN DEFAULT false,
  "time" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Tracking
  doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  original_bed_id UUID REFERENCES beds(bed_id) ON DELETE SET NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'admitted', 'assigned', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_icu_queue_patient_token ON icu_queue(patient_token);
CREATE INDEX IF NOT EXISTS idx_icu_queue_status ON icu_queue(status);
CREATE INDEX IF NOT EXISTS idx_icu_queue_doctor_id ON icu_queue(doctor_id);

-- RLS
ALTER TABLE icu_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access on icu_queue" ON icu_queue;
CREATE POLICY "Allow authenticated users full access on icu_queue" ON icu_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_icu_queue_updated_at
  BEFORE UPDATE ON public.icu_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  
