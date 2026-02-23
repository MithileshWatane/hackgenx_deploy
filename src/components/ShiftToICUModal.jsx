import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext_simple';
import NearbyHospitalsModal from './NearbyHospitalsModal';
import { autoAssignBed } from '../services/autoBedAssignmentService';

export default function ShiftToICUModal({ patient, onClose, onShift }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showNearbyHospitals, setShowNearbyHospitals] = useState(false);
    const [noBedsAvailable, setNoBedsAvailable] = useState(false);

    const [formData, setFormData] = useState({
        patient_token: patient?.token_number || '',
        patient_name: patient?.patient_name || '',
        diseases: patient?.disease || patient?.diseases || '',
        surgery_type: '',
        bed_type: 'icu',
        severity: 'critical',
        is_emergency: false,
        predicted_stay_days: 7,
        ventilator_needed: false,
        dialysis_needed: false,
    });

    // ── Scheduling Algorithm ──────────────────────────────────────────────────
    // Port of backend/services/icuScheduler.js:
    //  1. Emergency patients first
    //  2. Higher severity first (critical > severe > moderate)
    //  3. Earlier arrival time first
    //  4. Find best compatible bed (ventilator / dialysis requirements met)

    const severityRank = { critical: 4, severe: 3, moderate: 2, low: 1 };

    const findBestBed = (availableBeds, patient) => {
        let bestBed = null;
        let bestScore = -1;

        for (const bed of availableBeds) {
            // Hard compatibility check: patient requirements must be met
            const ventilatorOk = !patient.ventilator_needed || bed.ventilator_available;
            const dialysisOk = !patient.dialysis_needed || bed.dialysis_available;
            if (!ventilatorOk || !dialysisOk) continue;

            // Score: prefer beds with exact equipment match (avoid over-provisioning)
            let score = 0;
            if (bed.ventilator_available === patient.ventilator_needed) score += 1;
            if (bed.dialysis_available === patient.dialysis_needed) score += 1;

            if (score > bestScore) {
                bestScore = score;
                bestBed = bed;
            }
        }
        return bestBed;
    };

    /**
     * Find an ICU patient with stable or improving condition who can be moved to regular bed.
     * Returns the patient with the most recent daily round showing stable/improving status.
     */
    const findStablePatientForTransfer = async (doctorId) => {
        try {
            console.log('Finding stable patients for doctor:', doctorId);

            // DEBUG: Check all daily rounds first
            const { data: allRounds, error: allRoundsError } = await supabase
                .from('daily_rounds')
                .select('id, icu_queue_id, condition_status, created_at')
                .limit(10);
            console.log('DEBUG - All daily rounds sample:', allRounds, 'Error:', allRoundsError);

            // Get all assigned ICU patients for this doctor
            const { data: assignedPatients, error: patientsError } = await supabase
                .from('icu_queue')
                .select('id, patient_name, patient_token, doctor_id, assigned_bed_id, assigned_bed_label, diseases, ventilator_needed, dialysis_needed, severity')
                .eq('status', 'assigned')
                .eq('doctor_id', doctorId);

            console.log('Assigned ICU patients:', assignedPatients, 'Error:', patientsError);

            if (patientsError) {
                console.error('Error fetching assigned patients:', patientsError);
                return null;
            }

            if (!assignedPatients || assignedPatients.length === 0) {
                console.log('No assigned ICU patients found for doctor:', doctorId);
                return null;
            }

            console.log(`Found ${assignedPatients.length} assigned patients, checking daily rounds...`);

            // For each patient, get their latest daily round
            for (const patient of assignedPatients) {
                console.log(`Checking rounds for patient ${patient.patient_name} (ID: ${patient.id})`);

                const { data: rounds, error: roundsError } = await supabase
                    .from('daily_rounds')
                    .select('condition_status, created_at')
                    .eq('icu_queue_id', patient.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                console.log(`Daily rounds for ${patient.patient_name}:`, rounds, 'Error:', roundsError);

                if (roundsError) {
                    console.error(`Error fetching rounds for patient ${patient.id}:`, roundsError);
                    continue;
                }

                if (!rounds || rounds.length === 0) {
                    console.log(`No daily rounds found for patient ${patient.patient_name} (ID: ${patient.id})`);
                    continue;
                }

                const latestRound = rounds[0];
                console.log(`Latest round for ${patient.patient_name}: status=${latestRound.condition_status}`);

                // Check if condition is stable or improving
                if (latestRound.condition_status === 'stable' || latestRound.condition_status === 'improving') {
                    console.log(`✅ FOUND stable/improving patient: ${patient.patient_name} (${latestRound.condition_status})`);
                    return {
                        ...patient,
                        latest_condition: latestRound.condition_status,
                        round_date: latestRound.created_at
                    };
                } else {
                    console.log(`Patient ${patient.patient_name} has condition: ${latestRound.condition_status} - not eligible`);
                }
            }

            console.log('No stable/improving patient found after checking all assigned patients');
            return null;
        } catch (err) {
            console.error('Error finding stable patient:', err);
            return null;
        }
    };

    /**
     * Transfer an ICU patient to the regular bed queue and free their ICU bed.
     * Returns the freed ICU bed ID on success, null on failure.
     */
    const transferPatientToBedQueue = async (icuPatient) => {
        try {
            const now = new Date().toISOString();

            // 1. Add patient to bed_queue
            const { data: bedQueueEntry, error: queueError } = await supabase
                .from('bed_queue')
                .insert([{
                    patient_name: icuPatient.patient_name,
                    token_number: icuPatient.patient_token,
                    disease: icuPatient.diseases,
                    doctor_id: icuPatient.doctor_id,
                    status: 'waiting_for_bed',
                    bed_type: 'general',
                    admitted_from_opd_at: now,
                    notes: `Transferred from ICU Bed ${icuPatient.assigned_bed_label}. Condition: ${icuPatient.latest_condition}`
                }])
                .select()
                .single();

            if (queueError) {
                console.error('Error adding to bed_queue:', queueError);
                return null;
            }

            // Trigger auto bed assignment for the transferred patient (after 5s delay)
            if (bedQueueEntry?.id) {
                console.log('Will trigger auto bed assignment in 5 seconds for:', icuPatient.patient_name);
                setTimeout(async () => {
                    console.log('Triggering auto bed assignment for transferred patient:', icuPatient.patient_name);
                    const autoAssignResult = await autoAssignBed(
                        bedQueueEntry.id,
                        icuPatient.patient_name,
                        'general',
                        icuPatient.doctor_id
                    );
                    console.log('Auto assignment result:', autoAssignResult);
                }, 5000);
            }

            // 2. Update icu_queue status to discharged
            const { error: icuUpdateError } = await supabase
                .from('icu_queue')
                .update({
                    status: 'discharged',
                    discharged_at: now
                })
                .eq('id', icuPatient.id);

            if (icuUpdateError) {
                console.error('Error updating icu_queue:', icuUpdateError);
                return null;
            }

            // 3. Free the ICU bed - mark as available
            const { error: bedError } = await supabase
                .from('icu_beds')
                .update({ is_available: true })
                .eq('id', icuPatient.assigned_bed_id);

            if (bedError) {
                console.error('Error freeing ICU bed:', bedError);
                return null;
            }

            return icuPatient.assigned_bed_id;
        } catch (err) {
            console.error('Error transferring patient:', err);
            return null;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Insert patient into icu_queue
            const { data: insertedRows, error } = await supabase
                .from('icu_queue')
                .insert([{
                    ...formData,
                    doctor_id: user?.id,
                    original_bed_id: patient?.original_bed_id || null,
                    time: new Date().toISOString(),
                    status: 'waiting'
                }])
                .select();

            if (error) throw error;
            const queueEntry = insertedRows?.[0];

            // 2. Fetch available ICU beds for this doctor only
            const { data: availableBeds, error: bedError } = await supabase
                .from('icu_beds')
                .select('*')
                .eq('is_available', true)
                .eq('doctor_id', user?.id);  // Filter by current doctor

            if (bedError) throw bedError;

            let assignedBed = null;
            let reassignedFrom = null;

            if (availableBeds && availableBeds.length > 0) {
                // 3. Run scheduling algorithm to find best bed
                assignedBed = findBestBed(availableBeds, formData);

                if (assignedBed) {
                    const admissionTime = new Date();
                    const dischargeTime = new Date(admissionTime);
                    dischargeTime.setDate(dischargeTime.getDate() + (formData.predicted_stay_days || 7));

                    // 4a. Mark bed as occupied
                    const { error: bedUpdateError } = await supabase
                        .from('icu_beds')
                        .update({ is_available: false })
                        .eq('id', assignedBed.id);
                    if (bedUpdateError) throw bedUpdateError;

                    // 4b. Update icu_queue entry with assigned bed & status
                    if (queueEntry?.id) {
                        const { error: queueUpdateError } = await supabase
                            .from('icu_queue')
                            .update({
                                status: 'assigned',
                                assigned_bed_id: assignedBed.id,
                                assigned_bed_label: assignedBed.bed_id,
                                admission_time: admissionTime.toISOString(),
                                discharge_time: dischargeTime.toISOString(),
                            })
                            .eq('id', queueEntry.id);
                        if (queueUpdateError) throw queueUpdateError;
                    }
                }
            } else if (formData.is_emergency) {
                // EMERGENCY: No beds available - try to reassign from stable patient
                console.log('Emergency patient - checking for stable patients to transfer...');
                console.log('Current user ID:', user?.id);
                const stablePatient = await findStablePatientForTransfer(user?.id);

                if (stablePatient) {
                    console.log('Found stable patient for transfer:', stablePatient.patient_name, 'Condition:', stablePatient.latest_condition);
                    const freedBedId = await transferPatientToBedQueue(stablePatient);

                    if (freedBedId) {
                        // Re-fetch the now-available bed
                        const { data: freedBed } = await supabase
                            .from('icu_beds')
                            .select('*')
                            .eq('id', freedBedId)
                            .single();

                        if (freedBed) {
                            assignedBed = freedBed;
                            reassignedFrom = stablePatient;

                            const admissionTime = new Date();
                            const dischargeTime = new Date(admissionTime);
                            dischargeTime.setDate(dischargeTime.getDate() + (formData.predicted_stay_days || 7));

                            // Mark bed as occupied
                            const { error: bedUpdateError } = await supabase
                                .from('icu_beds')
                                .update({ is_available: false })
                                .eq('id', assignedBed.id);
                            if (bedUpdateError) throw bedUpdateError;

                            // Update emergency patient with assigned bed
                            if (queueEntry?.id) {
                                const { error: queueUpdateError } = await supabase
                                    .from('icu_queue')
                                    .update({
                                        status: 'assigned',
                                        assigned_bed_id: assignedBed.id,
                                        assigned_bed_label: assignedBed.bed_id,
                                        admission_time: admissionTime.toISOString(),
                                        discharge_time: dischargeTime.toISOString()
                                    })
                                    .eq('id', queueEntry.id);
                                if (queueUpdateError) throw queueUpdateError;
                            }
                        }
                    }
                } else {
                    console.log('No stable/improving patient found for emergency reassignment');
                }
            }

            setNoBedsAvailable(!assignedBed);

            // 5. Free the original general ward bed
            if (patient?.original_bed_id) {
                // 5a. Mark original bed as available in 'beds' table
                const { error: freeBedError } = await supabase
                    .from('beds')
                    .update({ status: 'available' })
                    .eq('bed_id', patient.original_bed_id);
                if (freeBedError) console.error('Error freeing original bed:', freeBedError);

                // 5b. Mark patient as discharged from the general ward queue in 'bed_queue' table
                // This ensures they no longer appear as occupying the bed in the UI
                const { error: freeQueueError } = await supabase
                    .from('bed_queue')
                    .update({
                        status: 'discharged',
                        discharged_at: new Date().toISOString()
                    })
                    .eq('bed_id', patient.original_bed_id)
                    .in('status', ['admitted', 'bed_assigned']);
                if (freeQueueError) console.error('Error updating original queue entry:', freeQueueError);
            }

            const message = assignedBed
                ? reassignedFrom
                    ? `🚨 EMERGENCY: ${formData.patient_name} assigned to ICU Bed ${assignedBed.bed_id}!\n\nBed reassigned from ${reassignedFrom.patient_name} (condition: ${reassignedFrom.latest_condition}).\n${reassignedFrom.patient_name} moved to regular bed queue.`
                    : `✅ ${formData.patient_name} assigned to ICU Bed ${assignedBed.bed_id}!\nEstimated discharge in ${formData.predicted_stay_days} days.`
                : formData.is_emergency
                    ? `🚨 EMERGENCY: ${formData.patient_name} added to ICU waiting queue.\n\nNo ICU beds available and no stable patients found for transfer.\nCheck "Nearby Hospitals" for available beds in other facilities.`
                    : `📋 ${formData.patient_name} added to ICU waiting queue.\n\nNo ICU bed currently available in this hospital.\nCheck "Nearby Hospitals" for available beds in other facilities.`;

            alert(message);
            
            // Show nearby hospitals modal if no beds available
            if (!assignedBed) {
                setShowNearbyHospitals(true);
            }
            
            onShift();
            if (assignedBed) {
                onClose();
            }
        } catch (err) {
            console.error('Shift to ICU error:', err);
            alert('Failed to shift patient: ' + err.message);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-red-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-red-600 text-xl">monitor_heart</span>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Shift to ICU</h2>
                            <p className="text-xs text-slate-500">Create ICU admission request for {patient?.patient_name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-slate-100 transition-colors">
                        <span className="material-symbols-outlined text-slate-500 text-xl">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto text-left">
                    {noBedsAvailable && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                            <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">info</span>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-800">No ICU beds available in this hospital</p>
                                <p className="text-xs text-amber-600 mt-1">
                                    Patient has been added to the waiting queue. You can check nearby hospitals with available beds.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowNearbyHospitals(true)}
                                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">location_on</span>
                                    Find Nearby Hospitals
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Patient Token</label>
                            <input type="text" value={formData.patient_token} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-mono" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Name</label>
                            <input type="text" value={formData.patient_name} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Diseases</label>
                            <input
                                type="text"
                                value={formData.diseases}
                                onChange={e => setFormData({ ...formData, diseases: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <input
                            type="checkbox"
                            id="is_emergency"
                            checked={formData.is_emergency}
                            onChange={e => setFormData({ ...formData, is_emergency: e.target.checked })}
                            className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                        />
                        <label htmlFor="is_emergency" className="text-sm font-semibold text-amber-800 cursor-pointer">
                            🚨 Emergency Patient (High Priority - May trigger bed reassignment)
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Surgery Type</label>
                            <input type="text" value={formData.surgery_type} onChange={e => setFormData({ ...formData, surgery_type: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none" placeholder="e.g. Cardiac Bypass" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Severity</label>
                            <select value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none">
                                <option value="critical">Critical</option>
                                <option value="severe">Severe</option>
                                <option value="moderate">Moderate</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Stay Duration (Est. Days)</label>
                            <input type="number" min="1" max="100" value={formData.predicted_stay_days} onChange={e => setFormData({ ...formData, predicted_stay_days: parseInt(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none" />
                        </div>
                    </div>

                    <div className="flex gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full transition-colors relative ${formData.ventilator_needed ? 'bg-red-500' : 'bg-slate-300'}`}>
                                <input type="checkbox" className="hidden" checked={formData.ventilator_needed} onChange={e => setFormData({ ...formData, ventilator_needed: e.target.checked })} />
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.ventilator_needed ? 'left-5' : 'left-1'}`} />
                            </div>
                            <span className="text-xs font-bold text-slate-700">Ventilator Needed</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full transition-colors relative ${formData.dialysis_needed ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                <input type="checkbox" className="hidden" checked={formData.dialysis_needed} onChange={e => setFormData({ ...formData, dialysis_needed: e.target.checked })} />
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.dialysis_needed ? 'left-5' : 'left-1'}`} />
                            </div>
                            <span className="text-xs font-bold text-slate-700">Dialysis Needed</span>
                        </label>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-200 transition-colors flex items-center justify-center gap-2">
                            {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">send</span>}
                            {loading ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
            
            {/* Nearby Hospitals Modal */}
            <NearbyHospitalsModal
                isOpen={showNearbyHospitals}
                onClose={() => setShowNearbyHospitals(false)}
                patientRequirements={{
                    needsVentilator: formData.ventilator_needed,
                    needsDialysis: formData.dialysis_needed
                }}
                title="Nearby Hospitals with ICU Beds"
            />
        </div>
    );
}
