-- Migration: Add address fields to user_profiles and patients tables
-- Created: February 2026

-- Add address columns to user_profiles table (for doctors)
ALTER TABLE IF EXISTS public.user_profiles
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- Add address columns to patients table
ALTER TABLE IF EXISTS public.patients
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- Create index on address fields for potential searching
CREATE INDEX IF NOT EXISTS idx_user_profiles_city ON public.user_profiles(city);
CREATE INDEX IF NOT EXISTS idx_patients_city ON public.patients(city);
