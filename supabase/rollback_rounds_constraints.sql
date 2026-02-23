-- ROLLBACK: Restore Foreign Key constraints for Daily Rounds system
-- Run this if you already executed the previous "flexible" migration and want to restore strict integrity.

-- 1. Clean up invalid data that doesn't exist in bed_queue to allow FB re-addition
DELETE FROM daily_rounds WHERE bed_queue_id NOT IN (SELECT id FROM bed_queue);
DELETE FROM medical_reports WHERE bed_queue_id NOT IN (SELECT id FROM bed_queue);
DELETE FROM discharge_predictions WHERE bed_queue_id NOT IN (SELECT id FROM bed_queue);

-- 2. Restore daily_rounds
ALTER TABLE daily_rounds DROP CONSTRAINT IF EXISTS daily_rounds_bed_queue_id_fkey;
ALTER TABLE daily_rounds ADD CONSTRAINT daily_rounds_bed_queue_id_fkey 
    FOREIGN KEY (bed_queue_id) REFERENCES bed_queue(id) ON DELETE CASCADE;

ALTER TABLE daily_rounds DROP CONSTRAINT IF EXISTS daily_rounds_bed_id_fkey;
ALTER TABLE daily_rounds ADD CONSTRAINT daily_rounds_bed_id_fkey 
    FOREIGN KEY (bed_id) REFERENCES beds(bed_id) ON DELETE SET NULL;

-- 3. Restore medical_reports
ALTER TABLE medical_reports DROP CONSTRAINT IF EXISTS medical_reports_bed_queue_id_fkey;
ALTER TABLE medical_reports ADD CONSTRAINT medical_reports_bed_queue_id_fkey 
    FOREIGN KEY (bed_queue_id) REFERENCES bed_queue(id) ON DELETE CASCADE;

-- 4. Restore discharge_predictions
ALTER TABLE discharge_predictions DROP CONSTRAINT IF EXISTS discharge_predictions_bed_queue_id_fkey;
ALTER TABLE discharge_predictions ADD CONSTRAINT discharge_predictions_bed_queue_id_fkey 
    FOREIGN KEY (bed_queue_id) REFERENCES bed_queue(id) ON DELETE CASCADE;
