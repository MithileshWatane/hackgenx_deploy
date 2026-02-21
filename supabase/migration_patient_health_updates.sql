-- Migration: Patient Health Updates and Medical Records
-- This enables ward boys to track patient health status and upload medical records
-- Prerequisites: bed_queue and beds tables must exist

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS patient_health_updates CASCADE;
DROP TABLE IF EXISTS patient_visit_history CASCADE;

-- Patient Health Updates Table
CREATE TABLE patient_health_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_queue_id UUID,
  bed_id UUID,
  patient_name TEXT NOT NULL,
  
  -- Health status information
  health_condition TEXT NOT NULL,
  vital_signs JSONB, -- Store vitals like BP, heart rate, temperature, etc.
  symptoms TEXT,
  additional_info TEXT,
  
  -- Staff information
  updated_by_name TEXT NOT NULL, -- Ward boy/nurse name
  updated_by_role TEXT DEFAULT 'ward_boy' CHECK (updated_by_role IN ('ward_boy', 'nurse', 'doctor')),
  
  -- AI Prediction
  ai_prediction JSONB, -- Store AI response including estimated discharge time
  estimated_discharge_date TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints separately (this helps identify which constraint fails)
ALTER TABLE patient_health_updates 
  ADD CONSTRAINT fk_patient_health_updates_bed_queue 
  FOREIGN KEY (bed_queue_id) REFERENCES bed_queue(id) ON DELETE CASCADE;

ALTER TABLE patient_health_updates 
  ADD CONSTRAINT fk_patient_health_updates_bed 
  FOREIGN KEY (bed_id) REFERENCES beds(bed_id) ON DELETE CASCADE;

-- Medical Records Table (for storing uploaded files)
CREATE TABLE medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_update_id UUID,
  bed_queue_id UUID,
  
  -- File information
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('lab_report', 'xray', 'ct_scan', 'mri', 'ecg', 'prescription', 'other')),
  file_format TEXT NOT NULL, -- pdf, jpg, png, etc.
  file_url TEXT NOT NULL, -- Supabase storage URL
  file_size INTEGER, -- in bytes
  
  -- Metadata
  description TEXT,
  uploaded_by_name TEXT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints separately
ALTER TABLE medical_records 
  ADD CONSTRAINT fk_medical_records_health_update 
  FOREIGN KEY (health_update_id) REFERENCES patient_health_updates(id) ON DELETE CASCADE;

ALTER TABLE medical_records 
  ADD CONSTRAINT fk_medical_records_bed_queue 
  FOREIGN KEY (bed_queue_id) REFERENCES bed_queue(id) ON DELETE CASCADE;

-- Patient Visit History Table (to track all previous visits)
CREATE TABLE patient_visit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  phone TEXT, -- To link visits by same patient
  
  -- Visit details
  visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
  diagnosis TEXT,
  treatment TEXT,
  medications TEXT,
  doctor_name TEXT,
  
  -- Link to current bed queue if applicable
  bed_queue_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint separately
ALTER TABLE patient_visit_history 
  ADD CONSTRAINT fk_patient_visit_history_bed_queue 
  FOREIGN KEY (bed_queue_id) REFERENCES bed_queue(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_updates_bed_queue ON patient_health_updates(bed_queue_id);
CREATE INDEX IF NOT EXISTS idx_health_updates_bed_id ON patient_health_updates(bed_id);
CREATE INDEX IF NOT EXISTS idx_health_updates_created_at ON patient_health_updates(created_at);

CREATE INDEX IF NOT EXISTS idx_medical_records_health_update ON medical_records(health_update_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_bed_queue ON medical_records(bed_queue_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_file_type ON medical_records(file_type);

CREATE INDEX IF NOT EXISTS idx_visit_history_patient_name ON patient_visit_history(patient_name);
CREATE INDEX IF NOT EXISTS idx_visit_history_phone ON patient_visit_history(phone);
CREATE INDEX IF NOT EXISTS idx_visit_history_visit_date ON patient_visit_history(visit_date);

-- Updated_at trigger for health updates
CREATE TRIGGER update_patient_health_updates_updated_at
  BEFORE UPDATE ON public.patient_health_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Row Level Security
ALTER TABLE patient_health_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_visit_history ENABLE ROW LEVEL SECURITY;

-- Policies (allow authenticated users full access)
CREATE POLICY "Allow authenticated users full access on patient_health_updates" 
  ON patient_health_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access on medical_records" 
  ON medical_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access on patient_visit_history" 
  ON patient_visit_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for medical records (run this separately in Supabase dashboard if needed)
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-records', 'medical-records', false);

-- Storage policies for medical records bucket
-- CREATE POLICY "Authenticated users can upload medical records"
--   ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'medical-records');

-- CREATE POLICY "Authenticated users can view medical records"
--   ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'medical-records');
