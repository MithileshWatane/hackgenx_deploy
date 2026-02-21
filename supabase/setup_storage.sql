-- Setup Storage Bucket for Medical Records
-- Run this in Supabase SQL Editor after running the migration_patient_health_updates.sql

-- Create storage bucket for medical records
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-records',
  'medical-records',
  false, -- Private bucket, requires authentication
  10485760, -- 10MB file size limit
  ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'application/pdf',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'application/pdf',
    'image/webp'
  ];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload medical records" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view medical records" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update medical records" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete medical records" ON storage.objects;

-- Storage policies for medical records bucket

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload medical records"
  ON storage.objects FOR INSERT 
  TO authenticated
  WITH CHECK (
    bucket_id = 'medical-records'
  );

-- Policy: Allow authenticated users to view files
CREATE POLICY "Authenticated users can view medical records"
  ON storage.objects FOR SELECT 
  TO authenticated
  USING (
    bucket_id = 'medical-records'
  );

-- Policy: Allow authenticated users to update files
CREATE POLICY "Authenticated users can update medical records"
  ON storage.objects FOR UPDATE 
  TO authenticated
  USING (
    bucket_id = 'medical-records'
  )
  WITH CHECK (
    bucket_id = 'medical-records'
  );

-- Policy: Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete medical records"
  ON storage.objects FOR DELETE 
  TO authenticated
  USING (
    bucket_id = 'medical-records'
  );

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify bucket creation
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'medical-records';

-- Verify policies
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%medical records%';
