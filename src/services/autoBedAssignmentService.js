import { supabase } from '../lib/supabase';

/**
 * Auto-assigns an available bed to a patient in the bed queue.
 * If no bed is available, returns estimated wait time based on discharge predictions.
 * 
 * @param {string} queueEntryId - The bed_queue entry ID
 * @param {string} patientName - Patient name for logging
 * @param {string} bedType - Type of bed required (default: 'general')
 * @returns {Object} - { success: boolean, bedAssigned: boolean, bed?: object, waitTimeMinutes?: number, message: string }
 */
export async function autoAssignBed(queueEntryId, patientName, bedType = 'general') {
    try {
        // 1. Fetch available beds of the requested type
        const { data: availableBeds, error: bedError } = await supabase
            .from('beds')
            .select('*')
            .eq('status', 'available')
            .eq('bed_type', bedType)
            .order('bed_number', { ascending: true });

        if (bedError) throw bedError;

        // 2. If beds are available, assign the first one
        if (availableBeds && availableBeds.length > 0) {
            const selectedBed = availableBeds[0];
            const bedId = selectedBed.bed_id || selectedBed.id;
            const now = new Date().toISOString();

            // Update bed_queue entry
            const { error: queueError } = await supabase
                .from('bed_queue')
                .update({
                    status: 'admitted',
                    bed_assigned_at: now,
                    admitted_at: now,
                    bed_type: bedType,
                    bed_id: bedId,
                    notes: `Auto-assigned to Bed: ${selectedBed.bed_number}`
                })
                .eq('id', queueEntryId);

            if (queueError) throw queueError;

            // Update bed status to occupied
            const { error: bedUpdateError } = await supabase
                .from('beds')
                .update({ status: 'occupied' })
                .eq('bed_id', bedId);

            if (bedUpdateError) throw bedUpdateError;

            // 3. Create default discharge prediction (4 days)
            const predictedDate = new Date();
            predictedDate.setDate(predictedDate.getDate() + 4);
            const predictedDischargeDate = predictedDate.toISOString().split('T')[0];

            const { error: predictionError } = await supabase
                .from('discharge_predictions')
                .insert([{
                    bed_queue_id: queueEntryId,
                    predicted_discharge_date: predictedDischargeDate,
                    remaining_days: 4,
                    confidence: 0.8,
                    reasoning: 'Initial estimated stay based on average admission duration'
                }]);

            if (predictionError) {
                console.error('Failed to create discharge prediction:', predictionError);
                // Don't fail the assignment if prediction creation fails
            }

            // 4. Update bed_queue with discharge_time
            const { error: updateDcError } = await supabase
                .from('bed_queue')
                .update({
                    discharge_time: `${predictedDischargeDate}T12:00:00Z`
                })
                .eq('id', queueEntryId);

            if (updateDcError) {
                console.error('Failed to update discharge time:', updateDcError);
            }

            return {
                success: true,
                bedAssigned: true,
                bed: selectedBed,
                message: `${patientName} auto-assigned to Bed ${selectedBed.bed_number}`
            };
        }

        // 3. No beds available - calculate estimated wait time
        const waitTimeMinutes = await calculateEstimatedWaitTime(bedType);
        console.log('Calculated wait time:', waitTimeMinutes, 'for patient:', patientName);

        // Update queue entry with estimated wait time
        const { error: updateError, data: updateData } = await supabase
            .from('bed_queue')
            .update({
                estimated_wait_minutes: Math.ceil(waitTimeMinutes),
                notes: `Waiting for bed. Estimated wait: ${formatWaitTime(waitTimeMinutes)}`
            })
            .eq('id', queueEntryId)
            .select();

        if (updateError) {
            console.error('Failed to update wait time in database:', updateError);
        } else {
            console.log('Successfully updated wait time:', updateData);
        }

        return {
            success: true,
            bedAssigned: false,
            waitTimeMinutes,
            message: `No ${bedType} bed available. Estimated wait: ${formatWaitTime(waitTimeMinutes)}`
        };

    } catch (error) {
        console.error('Auto-assign bed error:', error);
        return {
            success: false,
            bedAssigned: false,
            message: `Error auto-assigning bed: ${error.message}`
        };
    }
}

/**
 * Calculates estimated wait time based on discharge predictions of occupied beds.
 * Returns the minimum remaining time from all occupied beds of the specified type.
 * 
 * @param {string} bedType - Type of bed
 * @returns {number} - Estimated wait time in minutes
 */
async function calculateEstimatedWaitTime(bedType = 'general') {
    try {
        // Fetch occupied beds with their queue entries and discharge predictions
        // Use left join (!left) instead of inner join to get all occupied beds
        const { data: occupiedBeds, error } = await supabase
            .from('beds')
            .select(`
                *,
                queue_entry:bed_queue!left(
                    id,
                    admitted_at,
                    bed_assigned_at,
                    status,
                    predictions:discharge_predictions(
                        predicted_discharge_date,
                        remaining_days,
                        confidence,
                        created_at
                    )
                )
            `)
            .eq('status', 'occupied')
            .eq('bed_type', bedType);

        console.log('Occupied beds query result:', { occupiedBeds, error, count: occupiedBeds?.length });

        if (error) {
            console.error('Error fetching occupied beds:', error);
            return 30;
        }

        if (!occupiedBeds || occupiedBeds.length === 0) {
            console.log('No occupied beds found, returning default 30 min');
            return 30;
        }

        let earliestReleaseMinutes = Infinity;

        for (const bed of occupiedBeds) {
            console.log('Processing bed:', bed.bed_number, 'queue_entry:', bed.queue_entry);
            
            // Find active queue entry (admitted or bed_assigned status)
            const activeQueue = bed.queue_entry?.find(
                q => q.status === 'admitted' || q.status === 'bed_assigned'
            ) || bed.queue_entry?.[0];

            console.log('Active queue for bed', bed.bed_number, ':', activeQueue);

            if (activeQueue?.predictions?.length > 0) {
                // Get the most recent prediction
                const sortedPredictions = [...activeQueue.predictions].sort(
                    (a, b) => new Date(b.created_at) - new Date(a.created_at)
                );
                const latestPrediction = sortedPredictions[0];

                console.log('Latest prediction for bed', bed.bed_number, ':', latestPrediction);

                if (latestPrediction.remaining_days != null) {
                    // Convert remaining days to minutes
                    const remainingMinutes = latestPrediction.remaining_days * 24 * 60;
                    console.log('Using remaining_days:', latestPrediction.remaining_days, '->', remainingMinutes, 'minutes');
                    if (remainingMinutes < earliestReleaseMinutes) {
                        earliestReleaseMinutes = remainingMinutes;
                    }
                } else if (latestPrediction.predicted_discharge_date) {
                    // Calculate from predicted discharge date
                    const dischargeDate = new Date(latestPrediction.predicted_discharge_date + 'T00:00:00');
                    const now = new Date();
                    const diffMs = dischargeDate - now;
                    const diffMinutes = Math.max(0, Math.ceil(diffMs / (1000 * 60)));
                    
                    console.log('Using predicted_discharge_date:', latestPrediction.predicted_discharge_date, '->', diffMinutes, 'minutes');
                    
                    if (diffMinutes < earliestReleaseMinutes) {
                        earliestReleaseMinutes = diffMinutes;
                    }
                }
            } else {
                // No prediction available - use admission time + default stay duration
                const admittedAt = new Date(activeQueue?.bed_assigned_at || activeQueue?.admitted_at || Date.now());
                const now = new Date();
                const elapsedMinutes = (now - admittedAt) / (1000 * 60);
                
                // Assume average stay is 4 days (5760 minutes) - matching the default we set
                const averageStayMinutes = 4 * 24 * 60;
                const remainingMinutes = Math.max(0, averageStayMinutes - elapsedMinutes);
                
                console.log('No prediction, using default. Admitted:', admittedAt, 'Elapsed:', elapsedMinutes, 'Remaining:', remainingMinutes);
                
                if (remainingMinutes < earliestReleaseMinutes) {
                    earliestReleaseMinutes = remainingMinutes;
                }
            }
        }

        // If we couldn't calculate, return default 30 minutes
        if (earliestReleaseMinutes === Infinity) {
            console.log('Could not calculate, returning default 30 min');
            return 30;
        }

        console.log('Final earliest release minutes:', earliestReleaseMinutes, 'Formatted:', formatWaitTime(earliestReleaseMinutes));
        return Math.ceil(earliestReleaseMinutes);

    } catch (error) {
        console.error('Error calculating wait time:', error);
        return 30; // Default fallback
    }
}

/**
 * Assigns a single bed to the oldest waiting patient.
 * Use this when a specific bed becomes available (e.g., after discharge).
 * 
 * @returns {Object} - Assignment result
 */
export async function assignSinglePatient() {
    try {
        // Fetch the oldest waiting patient
        const { data: waitingPatients, error } = await supabase
            .from('bed_queue')
            .select('*')
            .eq('status', 'waiting_for_bed')
            .order('admitted_from_opd_at', { ascending: true })
            .limit(1);

        if (error) throw error;

        if (!waitingPatients || waitingPatients.length === 0) {
            return { assigned: 0, message: 'No waiting patients' };
        }

        const patient = waitingPatients[0];

        // Fetch one available bed
        const { data: availableBeds, error: bedError } = await supabase
            .from('beds')
            .select('*')
            .eq('status', 'available')
            .order('bed_number', { ascending: true })
            .limit(1);

        if (bedError) throw bedError;

        if (!availableBeds || availableBeds.length === 0) {
            return { assigned: 0, message: 'No beds available' };
        }

        const bed = availableBeds[0];
        const bedId = bed.bed_id || bed.id;
        const now = new Date().toISOString();

        // Update bed_queue
        const { error: queueError } = await supabase
            .from('bed_queue')
            .update({
                status: 'admitted',
                bed_assigned_at: now,
                admitted_at: now,
                bed_type: bed.bed_type,
                bed_id: bedId,
                notes: `Auto-assigned to Bed: ${bed.bed_number}`,
                estimated_wait_minutes: null
            })
            .eq('id', patient.id);

        if (queueError) throw queueError;

        // Update bed status
        const { error: bedUpdateError } = await supabase
            .from('beds')
            .update({ status: 'occupied' })
            .eq('bed_id', bedId);

        if (bedUpdateError) throw bedUpdateError;

        // Create default discharge prediction (4 days)
        const predictedDate = new Date();
        predictedDate.setDate(predictedDate.getDate() + 4);
        const predictedDischargeDate = predictedDate.toISOString().split('T')[0];

        const { error: predictionError } = await supabase
            .from('discharge_predictions')
            .insert([{
                bed_queue_id: patient.id,
                predicted_discharge_date: predictedDischargeDate,
                remaining_days: 4,
                confidence: 0.8,
                reasoning: 'Initial estimated stay based on average admission duration'
            }]);

        if (predictionError) {
            console.error(`Failed to create prediction for ${patient.patient_name}:`, predictionError);
        }

        // Update bed_queue with discharge_time
        const { error: updateDcError } = await supabase
            .from('bed_queue')
            .update({
                discharge_time: `${predictedDischargeDate}T12:00:00Z`
            })
            .eq('id', patient.id);

        if (updateDcError) {
            console.error(`Failed to update discharge time for ${patient.patient_name}:`, updateDcError);
        }

        return {
            assigned: 1,
            patient: patient.patient_name,
            bed: bed.bed_number,
            message: `${patient.patient_name} auto-assigned to Bed ${bed.bed_number}`
        };

    } catch (error) {
        console.error('Assign single patient error:', error);
        return { assigned: 0, message: `Error: ${error.message}` };
    }
}

/**
 * Attempts to auto-assign beds to all waiting patients in the queue.
 * Called when a bed becomes available (e.g., after discharge).
 * 
 * @returns {Object} - Assignment results
 */
export async function processWaitingQueue() {
    try {
        // Fetch all waiting patients ordered by admission time (FIFO)
        const { data: waitingPatients, error } = await supabase
            .from('bed_queue')
            .select('*')
            .eq('status', 'waiting_for_bed')
            .order('admitted_from_opd_at', { ascending: true });

        if (error) throw error;

        if (!waitingPatients || waitingPatients.length === 0) {
            return { processed: 0, assigned: 0, message: 'No waiting patients' };
        }

        // Fetch available beds
        const { data: availableBeds, error: bedError } = await supabase
            .from('beds')
            .select('*')
            .eq('status', 'available')
            .order('bed_number', { ascending: true });

        if (bedError) throw bedError;

        if (!availableBeds || availableBeds.length === 0) {
            return { processed: waitingPatients.length, assigned: 0, message: 'No beds available' };
        }

        // Assign beds to waiting patients
        let assignedCount = 0;
        const assignments = [];

        for (let i = 0; i < Math.min(waitingPatients.length, availableBeds.length); i++) {
            const patient = waitingPatients[i];
            const bed = availableBeds[i];
            const bedId = bed.bed_id || bed.id;
            const now = new Date().toISOString();

            // Update bed_queue
            const { error: queueError } = await supabase
                .from('bed_queue')
                .update({
                    status: 'admitted',
                    bed_assigned_at: now,
                    admitted_at: now,
                    bed_type: bed.bed_type,
                    bed_id: bedId,
                    notes: `Auto-assigned to Bed: ${bed.bed_number}`,
                    estimated_wait_minutes: null // Clear wait time
                })
                .eq('id', patient.id);

            if (queueError) {
                console.error(`Failed to assign bed to ${patient.patient_name}:`, queueError);
                continue;
            }

            // Update bed status
            const { error: bedUpdateError } = await supabase
                .from('beds')
                .update({ status: 'occupied' })
                .eq('bed_id', bedId);

            if (bedUpdateError) {
                console.error(`Failed to update bed status for ${bed.bed_number}:`, bedUpdateError);
                continue;
            }

            // Create default discharge prediction (4 days)
            const predictedDate = new Date();
            predictedDate.setDate(predictedDate.getDate() + 4);
            const predictedDischargeDate = predictedDate.toISOString().split('T')[0];

            const { error: predictionError } = await supabase
                .from('discharge_predictions')
                .insert([{
                    bed_queue_id: patient.id,
                    predicted_discharge_date: predictedDischargeDate,
                    remaining_days: 4,
                    confidence: 0.8,
                    reasoning: 'Initial estimated stay based on average admission duration'
                }]);

            if (predictionError) {
                console.error(`Failed to create prediction for ${patient.patient_name}:`, predictionError);
            }

            // Update bed_queue with discharge_time
            const { error: updateDcError } = await supabase
                .from('bed_queue')
                .update({
                    discharge_time: `${predictedDischargeDate}T12:00:00Z`
                })
                .eq('id', patient.id);

            if (updateDcError) {
                console.error(`Failed to update discharge time for ${patient.patient_name}:`, updateDcError);
            }

            assignedCount++;
            assignments.push({
                patient: patient.patient_name,
                bed: bed.bed_number
            });
        }

        return {
            processed: waitingPatients.length,
            assigned: assignedCount,
            assignments,
            message: `Assigned ${assignedCount} of ${waitingPatients.length} waiting patients`
        };

    } catch (error) {
        console.error('Process waiting queue error:', error);
        return { processed: 0, assigned: 0, message: `Error: ${error.message}` };
    }
}

/**
 * Formats wait time in minutes to human-readable string.
 * 
 * @param {number} minutes - Wait time in minutes
 * @returns {string} - Formatted string
 */
function formatWaitTime(minutes) {
    if (minutes < 60) {
        return `${Math.ceil(minutes)} min`;
    } else if (minutes < 24 * 60) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.ceil(minutes % 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else {
        const days = Math.floor(minutes / (24 * 60));
        const hours = Math.floor((minutes % (24 * 60)) / 60);
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
}

/**
 * Public utility to format wait time.
 */
export { formatWaitTime };
