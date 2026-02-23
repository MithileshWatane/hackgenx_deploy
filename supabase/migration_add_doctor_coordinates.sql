-- Migration: Add coordinate columns to user_profiles for doctor location
-- Allows doctors to select their hospital location on a map during registration

-- Add latitude and longitude columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add index for faster location-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_location ON user_profiles(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Update the handle_new_user function to include coordinates from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, street, city, state, zip_code, country, latitude, longitude)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    NEW.raw_user_meta_data->>'street',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'zipCode',
    COALESCE(NEW.raw_user_meta_data->>'country', 'India'),
    -- Only store coordinates for doctors, NULL for patients
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'doctor' THEN (NEW.raw_user_meta_data->>'latitude')::DECIMAL(10, 8)
      ELSE NULL
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'doctor' THEN (NEW.raw_user_meta_data->>'longitude')::DECIMAL(11, 8)
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
