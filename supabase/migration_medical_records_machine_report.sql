-- Add 'machine_report' to allowed file_type in medical_records
-- Run after migration_patient_health_updates.sql

ALTER TABLE medical_records
  DROP CONSTRAINT IF EXISTS medical_records_file_type_check;

ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_file_type_check
  CHECK (file_type IN (
    'lab_report',
    'xray',
    'ct_scan',
    'mri',
    'ecg',
    'prescription',
    'machine_report',
    'other'
  ));
