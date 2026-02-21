-- Hospital Daily Round Discharge Prediction System - Database Schema

-- 1. Daily Rounds Table
-- Stores clinical data from daily patient check-ups.
CREATE TABLE IF NOT EXISTS daily_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bed_queue_id UUID NOT NULL REFERENCES bed_queue(id) ON DELETE CASCADE,
    bed_id UUID REFERENCES beds(bed_id) ON DELETE SET NULL,
    round_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    temperature DECIMAL(5,2),
    heart_rate INTEGER,
    blood_pressure TEXT,
    oxygen_level DECIMAL(5,2),
    condition_status TEXT NOT NULL CHECK (condition_status IN ('improving', 'stable', 'critical')),
    doctor_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Medical Reports Table
-- Stores links to medical reports (PDF/Images) and AI-generated summaries.
CREATE TABLE IF NOT EXISTS medical_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bed_queue_id UUID NOT NULL REFERENCES bed_queue(id) ON DELETE CASCADE,
    round_id UUID REFERENCES daily_rounds(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('blood', 'xray', 'scan')),
    ai_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Discharge Predictions Table
-- Stores AI predictions for patient discharge based on daily rounds data.
CREATE TABLE IF NOT EXISTS discharge_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bed_queue_id UUID NOT NULL REFERENCES bed_queue(id) ON DELETE CASCADE,
    round_id UUID REFERENCES daily_rounds(id) ON DELETE SET NULL,
    predicted_discharge_date DATE,
    remaining_days INTEGER,
    confidence DECIMAL(5,2),
    reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (bed_queue_id, round_id)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_daily_rounds_bed_queue_id ON daily_rounds(bed_queue_id);
CREATE INDEX IF NOT EXISTS idx_daily_rounds_round_date ON daily_rounds(round_date);
CREATE INDEX IF NOT EXISTS idx_medical_reports_bed_queue_id ON medical_reports(bed_queue_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_round_id ON medical_reports(round_id);
CREATE INDEX IF NOT EXISTS idx_discharge_predictions_bed_queue_id ON discharge_predictions(bed_queue_id);
CREATE INDEX IF NOT EXISTS idx_discharge_predictions_round_id ON discharge_predictions(round_id);

-- Add updated_at trigger for daily_rounds
-- Note: This assumes public.update_updated_at_column() exists as per complete_schema.sql
CREATE TRIGGER update_daily_rounds_updated_at
    BEFORE UPDATE ON daily_rounds
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
