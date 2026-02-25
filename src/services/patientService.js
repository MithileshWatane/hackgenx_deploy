import { supabase } from '../lib/supabase';

/**
 * Fetch all active (non-discharged) patients from bed_queue and icu_queue
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function getActivePatients() {
  try {
    // Fetch from bed_queue - patients not discharged
    const { data: bedQueuePatients, error: bedError } = await supabase
      .from('bed_queue')
      .select(`
        id,
        patient_name,
        disease,
        token_number,
        age,
        phone,
        bed_type,
        status,
        admitted_at,
        bed_assigned_at,
        admitted_from_opd_at,
        discharged_at,
        doctor_id,
        created_at
      `)
      .neq('status', 'discharged')
      .order('admitted_at', { ascending: false });

    if (bedError) throw bedError;

    // Fetch from icu_queue - patients not discharged
    const { data: icuPatients, error: icuError } = await supabase
      .from('icu_queue')
      .select(`
        id,
        patient_name,
        diseases,
        patient_token,
        severity,
        status,
        admission_time,
        discharge_time,
        assigned_bed_label,
        ventilator_needed,
        dialysis_needed,
        doctor_id,
        created_at
      `)
      .neq('status', 'discharged')
      .order('admission_time', { ascending: false });

    if (icuError) throw icuError;

    // Transform and combine both datasets
    const transformedBedPatients = (bedQueuePatients || []).map(p => ({
      ...p,
      queue_type: 'bed',
      display_disease: p.disease,
      display_token: p.token_number,
      display_bed: p.bed_type,
      admitted_date: p.admitted_at || p.bed_assigned_at || p.admitted_from_opd_at,
    }));

    const transformedIcuPatients = (icuPatients || []).map(p => ({
      ...p,
      queue_type: 'icu',
      display_disease: p.diseases,
      display_token: p.patient_token,
      display_bed: p.assigned_bed_label || 'ICU',
      admitted_date: p.admission_time,
    }));

    // Combine and sort by admission date (most recent first)
    const allPatients = [...transformedBedPatients, ...transformedIcuPatients]
      .sort((a, b) => new Date(b.admitted_date || b.created_at) - new Date(a.admitted_date || a.created_at));

    return { data: allPatients, error: null };
  } catch (error) {
    console.error('Error fetching active patients:', error);
    return { data: [], error };
  }
}

/**
 * Fetch a single patient by ID from either bed_queue or icu_queue
 * @param {string} patientId - The patient queue ID
 * @param {string} queueType - 'bed' or 'icu'
 * @returns {Promise<{data: object, error: any}>}
 */
export async function getPatientById(patientId, queueType) {
  try {
    if (queueType === 'icu') {
      // For ICU, we need to fetch the queue data first, then get patient details
      const { data: queueData, error: queueError } = await supabase
        .from('icu_queue')
        .select(`
          *,
          discharge_predictions!icu_queue_id (*)
        `)
        .eq('id', patientId)
        .single();
      
      if (queueError) throw queueError;
      
      // Fetch patient details from appointments table using patient_token
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('age, phone')
        .eq('token_number', queueData.patient_token)
        .single();
      
      // If patient came from general ward, fetch the bed queue history
      let originalBedData = null;
      if (queueData.original_bed_id) {
        const { data: bedData, error: bedError } = await supabase
          .from('bed_queue')
          .select('admitted_from_opd_at, bed_assigned_at, admitted_at, bed_type')
          .eq('bed_id', queueData.original_bed_id)
          .eq('token_number', queueData.patient_token)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!bedError && bedData) {
          originalBedData = bedData;
        }
      }
      
      // Merge the data
      const mergedData = {
        ...queueData,
        queue_type: 'icu',
        age: appointmentData?.age || null,
        phone: appointmentData?.phone || null,
        // Include original bed queue timestamps if available
        admitted_from_opd_at: originalBedData?.admitted_from_opd_at || queueData.admitted_from_opd_at,
        bed_assigned_at: originalBedData?.bed_assigned_at || queueData.bed_assigned_at,
        admitted_at: originalBedData?.admitted_at || queueData.admitted_at,
        original_bed_type: originalBedData?.bed_type
      };
      
      return { data: mergedData, error: null };
    } else {
      // For bed_queue patients
      const { data: queueData, error: queueError } = await supabase
        .from('bed_queue')
        .select(`
          *,
          discharge_predictions!bed_queue_id (*)
        `)
        .eq('id', patientId)
        .single();
      
      if (queueError) throw queueError;
      
      // Fetch patient details from appointments table using token_number
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('age, phone')
        .eq('token_number', queueData.token_number)
        .single();
      
      // Merge the data
      const mergedData = {
        ...queueData,
        queue_type: 'bed',
        age: appointmentData?.age || queueData.age || null,
        phone: appointmentData?.phone || queueData.phone || null
      };
      
      return { data: mergedData, error: null };
    }
  } catch (error) {
    console.error('Error fetching patient:', error);
    return { data: null, error };
  }
}

/**
 * Fetch full patient journey data including appointment, opd_queue, and all timestamps
 * @param {string} patientToken - The patient's token number
 * @returns {Promise<{data: object, error: any}>}
 */
export async function getPatientJourney(patientToken) {
  try {
    // Fetch appointment data
    const { data: appointmentData, error: apptError } = await supabase
      .from('appointments')
      .select('id, appointment_date, created_at, status')
      .eq('token_number', patientToken)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Fetch OPD queue data
    const { data: opdData, error: opdError } = await supabase
      .from('opd_queue')
      .select('id, entered_queue_at, consultation_started_at, completed_at, status')
      .eq('token_number', patientToken)
      .order('entered_queue_at', { ascending: false })
      .limit(1)
      .single();

    return {
      data: {
        appointment: appointmentData || null,
        opdQueue: opdData || null
      },
      error: null
    };
  } catch (error) {
    console.error('Error fetching patient journey:', error);
    return { data: { appointment: null, opdQueue: null }, error };
  }
}

/**
 * Fetch daily rounds for a patient
 * @param {string} queueId - The queue ID
 * @param {string} queueType - 'bed' or 'icu'
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function getPatientRounds(queueId, queueType) {
  try {
    const queueIdField = queueType === 'icu' ? 'icu_queue_id' : 'bed_queue_id';
    
    const { data, error } = await supabase
      .from('daily_rounds')
      .select('*')
      .eq(queueIdField, queueId)
      .order('round_date', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching patient rounds:', error);
    return { data: [], error };
  }
}

/**
 * Get the latest discharge prediction for a patient
 * @param {string} queueId - The queue ID
 * @param {string} queueType - 'bed' or 'icu'
 * @returns {Promise<{data: object, error: any}>}
 */
export async function getLatestPrediction(queueId, queueType) {
  try {
    const queueIdField = queueType === 'icu' ? 'icu_queue_id' : 'bed_queue_id';
    
    const { data, error } = await supabase
      .from('discharge_predictions')
      .select('*')
      .eq(queueIdField, queueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return { data: data || null, error: null };
  } catch (error) {
    console.error('Error fetching prediction:', error);
    return { data: null, error };
  }
}
