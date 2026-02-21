-- CREATE PERMISSIVE POLICY FOR STORAGE
-- This allows all operations without disabling RLS
-- Run this in Supabase SQL Editor

-- Step 1: Make bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'medical-records';

-- Step 2: Drop any existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated uploads to medical-records" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from medical-records" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to medical-records" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from medical-records" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload medical records" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view medical records" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update medical records" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete medical records" ON storage.objects;

-- Step 3: Create permissive policies that allow EVERYONE (public bucket)
CREATE POLICY "Public Access - medical-records"
ON storage.objects FOR ALL
USING (bucket_id = 'medical-records')
WITH CHECK (bucket_id = 'medical-records');

-- Step 4: Verify
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%medical-records%';

-- Should show one policy: "Public Access - medical-records" with cmd = "*"
