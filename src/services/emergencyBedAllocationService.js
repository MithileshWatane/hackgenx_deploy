import { supabase } from '../lib/supabase';
import { sendBedAssignmentNotification } from './bedNotificationService';

/**
 * Finds the best compatible ICU bed for a patient based on their requirements
 */
function findBestBed(availableBeds, patient) {
    let bestBed = null;
    let bestScore = -1;

    for (const bed of availableBeds) {
        const ventilatorOk = !patient.ventilator_needed || bed.ventilator_available;
        const dialysisOk = !patient.dialysis_needed || bed.dialysis_available;
        if (!ventilatorOk || !dialysisOk) continue;

        let score = 0;
        if (bed.ventilator_available === patient.ventilator_needed) score += 1;
        if (bed.dialysis_available === patient.dialysis_needed) score += 1;

        if (score > bestScore) {
            bestScore = score;
            bestBed = bed;
        }
    }
    return bestBed;
}

/**
 * Attempts to allocate an ICU bed for an emergency patient.
 * If no beds are available, it will try to transfer a stable/improving patient to a general bed.
 * 
 * @param {Object} params - Parameters for bed allocation
 * @param {string} params.icuQueueId - The ICU queue entry ID
 * @param {string} params.doctorId - The doctor ID
 * @param {Object} params.patientRequirements - Patient requirements (ventilator_needed, dialysis_needed)
 * @param {number} params.predictedStayDays - Predicted stay duration in days
 * @returns {Object} - Result object with success status and details
 */
export async function allocateEmergencyICUBed({ icuQueueId, doctorId, patientRequirements, predictedStayDays = 7 }) {
    try {
        let bedWasFreed = false;
        let transferredPatientName = null;

        // 1. Check for available ICU beds
        const { data: availableBeds, error: bedError } = await supabase
            .from('icu_beds')
            .select('*')
            .eq('is_available', true)
            .eq('doctor_id', doctorId);

        if (bedError) throw bedError;

        let assignedBed = null;

        // 2. If no beds available, try to free up a bed by transferring stable patient
        if (!availableBeds || availableBeds.length === 0) {
            console.log('No ICU beds available for emergency patient. Checking for stable patients to transfer...');

            // Find ICU patients who are stable/improving based on their latest round
            const { data: icuPatients, error: icuPatientsError } = await supabase
                .from('icu_queue')
                .select(`
                    id,
                    patient_name,
                    assigned_bed_id,
                    assigned_bed_label,
                    patient_token,
                    diseases,
                    doctor_id,
                    daily_rounds (
                        id,
                        condition_status,
                        round_date
                    )
                `)
                .eq('status', 'assigned')
                .eq('doctor_id', doctorId)
                .not('assigned_bed_id', 'is', null);

            if (icuPatientsError) {
                console.error('Error fetching ICU patients:', icuPatientsError);
            } else if (icuPatients && icuPatients.length > 0) {
                // Find patients with stable/improving condition in their latest round
                let candidateForTransfer = null;

                for (const icuPatient of icuPatients) {
                    if (icuPatient.daily_rounds && icuPatient.daily_rounds.length > 0) {
                        // Sort rounds by date to get the latest
                        const sortedRounds = icuPatient.daily_rounds.sort((a, b) =>
                            new Date(b.round_date) - new Date(a.round_date)
                        );
                        const latestRound = sortedRounds[0];

                        if (latestRound.condition_status === 'stable' || latestRound.condition_status === 'improving') {
                            candidateForTransfer = icuPatient;
                            break; // Found a candidate
                        }
                    }
                }

                // If we found a stable/improving patient, transfer them to general bed
                if (candidateForTransfer) {
                    console.log(`Found stable patient to transfer: ${candidateForTransfer.patient_name}`);

                    // Check if general beds are available
                    const { data: generalBeds, error: generalBedError } = await supabase
                        .from('beds')
                        .select('*')
                        .eq('status', 'available')
                        .eq('doctor_id', doctorId)
                        .limit(1);

                    if (!generalBedError && generalBeds && generalBeds.length > 0) {
                        const generalBed = generalBeds[0];

                        // Transfer stable patient to general bed queue
                        const transferTimestamp = new Date().toISOString();
                        console.log('Inserting patient into bed_queue with status: admitted');
                        const { data: transferredData, error: transferError } = await supabase
                            .from('bed_queue')
                            .insert([{
                                opd_queue_id: null,  // No OPD queue reference (came from ICU)
                                appointment_id: null,  // No appointment reference (came from ICU)
                                patient_name: candidateForTransfer.patient_name,
                                disease: candidateForTransfer.diseases,
                                token_number: candidateForTransfer.patient_token,
                                age: null,  // Not available from ICU queue
                                phone: null,  // Not available from ICU queue
                                doctor_id: candidateForTransfer.doctor_id,
                                bed_type: 'general',
                                bed_id: generalBed.bed_id,  // Use bed_id (the primary key UUID)
                                status: 'admitted',  // Set as admitted, not just bed_assigned
                                bed_assigned_at: transferTimestamp,
                                admitted_at: transferTimestamp,  // Admission timestamp
                                admitted_from_opd_at: transferTimestamp,  // When added to bed queue
                                discharged_at: null,  // Not discharged yet
                                notes: `Transferred from ICU to accommodate emergency patient at ${transferTimestamp}`,
                                created_at: transferTimestamp,
                            }])
                            .select();

                        if (transferError) {
                            console.error('Error transferring patient to bed_queue:', transferError);
                            console.error('Transfer error details:', JSON.stringify(transferError, null, 2));
                        } else {
                            console.log('Successfully inserted into bed_queue:', transferredData);
                            if (transferredData && transferredData.length > 0) {
                                console.log('Inserted patient status:', transferredData[0].status);
                                console.log('Inserted patient ID:', transferredData[0].id);
                                console.log('Full inserted record:', JSON.stringify(transferredData[0], null, 2));
                            }
                        }

                        if (!transferError) {
                            console.log(`Transferred ${candidateForTransfer.patient_name} to general bed ${generalBed.bed_number || generalBed.bed_id}`);

                            // Create discharge prediction for the transferred patient
                            if (transferredData && transferredData.length > 0) {
                                const bedQueueId = transferredData[0].id;
                                const predictedStayDays = 4; // Default stay for stable patients
                                const predictedDischargeDate = new Date();
                                predictedDischargeDate.setDate(predictedDischargeDate.getDate() + predictedStayDays);

                                const { error: predictionError } = await supabase
                                    .from('discharge_predictions')
                                    .insert([{
                                        bed_queue_id: bedQueueId,
                                        predicted_discharge_date: predictedDischargeDate.toISOString().split('T')[0], // Date only
                                        remaining_days: predictedStayDays,
                                        confidence: 0.75, // 75% confidence for stable patient transfer
                                        reasoning: 'Stable patient transferred from ICU to general ward. Estimated recovery time based on improved condition.',
                                        created_at: new Date().toISOString(),
                                    }]);

                                if (predictionError) {
                                    console.error('Error creating discharge prediction:', predictionError);
                                } else {
                                    console.log(`Created discharge prediction: ${predictedStayDays} days`);
                                }
                            }

                            // Mark general bed as occupied
                            const { error: bedUpdateError } = await supabase
                                .from('beds')
                                .update({ status: 'occupied' })
                                .eq('bed_id', generalBed.bed_id);  // Use bed_id (the primary key)

                            if (bedUpdateError) {
                                console.error('Error updating general bed status:', bedUpdateError);
                            }

                            // Send Notification (Non-blocking)
                            sendBedAssignmentNotification({
                                patientName: candidateForTransfer.patient_name,
                                bedNumber: generalBed.bed_number,
                                bedType: 'general',
                                appointmentId: null, // We'll try to fetch phone via token inside the service
                                tokenNumber: candidateForTransfer.patient_token
                            });

                            // Free up the ICU bed
                            await supabase
                                .from('icu_beds')
                                .update({ is_available: true })
                                .eq('id', candidateForTransfer.assigned_bed_id);

                            // Update the stable patient's ICU queue status
                            await supabase
                                .from('icu_queue')
                                .update({
                                    status: 'discharged',
                                    discharged_at: new Date().toISOString()
                                })
                                .eq('id', candidateForTransfer.id);

                            // Now fetch the freed ICU bed for the emergency patient
                            const { data: freedBed, error: freedBedError } = await supabase
                                .from('icu_beds')
                                .select('*')
                                .eq('id', candidateForTransfer.assigned_bed_id)
                                .single();

                            if (!freedBedError && freedBed) {
                                assignedBed = freedBed;
                                bedWasFreed = true;
                                transferredPatientName = candidateForTransfer.patient_name;
                                console.log(`Successfully freed ICU bed ${freedBed.bed_id} for emergency patient`);
                                // Don't return here - continue to step 4 to assign the bed
                            }
                        }
                    }
                }
            }
        }

        // 3. If we have available beds, find the best match
        if (!assignedBed && availableBeds && availableBeds.length > 0) {
            assignedBed = findBestBed(availableBeds, patientRequirements);
        }

        // 4. If we have a bed, assign it
        if (assignedBed) {
            const admissionTime = new Date();
            const dischargeTime = new Date(admissionTime);
            dischargeTime.setDate(dischargeTime.getDate() + predictedStayDays);

            // Mark bed as occupied
            const { error: bedUpdateError } = await supabase
                .from('icu_beds')
                .update({ is_available: false })
                .eq('id', assignedBed.id);

            if (bedUpdateError) throw bedUpdateError;

            // Update ICU queue entry
            const { error: queueUpdateError } = await supabase
                .from('icu_queue')
                .update({
                    status: 'assigned',
                    assigned_bed_id: assignedBed.id,
                    assigned_bed_label: assignedBed.bed_id,
                    admission_time: admissionTime.toISOString(),
                    discharge_time: dischargeTime.toISOString(),
                })
                .eq('id', icuQueueId);

            if (queueUpdateError) throw queueUpdateError;

            return {
                success: true,
                bedFreed: bedWasFreed,
                transferredPatient: transferredPatientName,
                bed: assignedBed,
                message: bedWasFreed
                    ? `ICU bed ${assignedBed.bed_id} assigned (transferred ${transferredPatientName} to general ward)`
                    : `ICU bed ${assignedBed.bed_id} assigned successfully`
            };
        }

        // 5. No bed could be allocated
        return {
            success: false,
            message: 'No ICU beds available and no stable patients to transfer'
        };

    } catch (error) {
        console.error('Emergency bed allocation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
