import { supabase } from '../lib/supabase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * Fetches the patient's phone number and sends a bed assignment notification.
 * 
 * @param {Object} params - Parameters for notification
 * @param {string} params.patientName - Patient name
 * @param {string} params.bedNumber - Bed number assigned
 * @param {string} params.bedType - Bed type assigned
 * @param {string} params.phone - Optional phone number (if already known)
 * @param {string} params.appointmentId - Optional appointment ID to fetch phone
 * @param {string} params.tokenNumber - Optional token number to fallback fetch phone
 */
export async function sendBedAssignmentNotification({ patientName, bedNumber, bedType, phone: initialPhone, appointmentId, tokenNumber }) {
    try {
        let phone = initialPhone || null;

        // 1. Try to fetch phone from appointments using appointmentId
        if (!phone && appointmentId) {
            const { data, error } = await supabase
                .from('appointments')
                .select('phone')
                .eq('id', appointmentId)
                .single();

            if (!error && data) {
                phone = data.phone;
            }
        }

        // 2. Fallback: try to fetch phone from appointments using token_number
        if (!phone && tokenNumber) {
            const { data, error } = await supabase
                .from('appointments')
                .select('phone')
                .eq('token_number', tokenNumber)
                .maybeSingle();

            if (!error && data) {
                phone = data.phone;
            }
        }

        // 3. Last fallback: try to fetch phone from appointments using patientName (latest record)
        if (!phone && patientName) {
            const { data, error } = await supabase
                .from('appointments')
                .select('phone')
                .eq('patient_name', patientName)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!error && data && data.length > 0) {
                phone = data[0].phone;
            }
        }

        if (!phone) {
            console.warn('[Notification] Could not find phone number for patient:', patientName);
            return;
        }

        // 3. Call backend to send WhatsApp notification
        const res = await fetch(`${BACKEND_URL}/api/sms/send-bed-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                phone,
                patientName,
                bedNumber,
                bedType
            }),
        });

        const data = await res.json();
        if (data.success) {
            console.log("[Notification] Bed assignment notification sent — SID:", data.sid);
        } else {
            console.warn("[Notification] Failed to send:", data.error);
        }
    } catch (err) {
        console.error("[Notification] Error:", err.message);
    }
}
