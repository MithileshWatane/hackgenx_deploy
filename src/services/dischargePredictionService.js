import { supabase } from '../lib/supabase';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Main entry point: run discharge prediction after a daily round is saved.
 * @param { string } queueId - The queue.id(bed_queue or icu_queue) for the current patient stay.
 * @param { string } currentRoundId - The id of the round just saved.
 * @param { object } bedQueueEntry - The queue row.
 * @param { boolean } isICU - Whether this is an ICU patient.
 */
export async function runDischargePrediction(queueId, currentRoundId, bedQueueEntry, isICU = false) {
    const queueIdField = isICU ? 'icu_queue_id' : 'bed_queue_id';
    try {
        // ── Step 1: Fetch all rounds for this patient stay, ordered by date ────
        const { data: rounds, error: roundsError } = await supabase
            .from('daily_rounds')
            .select('*')
            .eq(queueIdField, queueId)
            .order('round_date', { ascending: true });

        if (roundsError) throw roundsError;

        // ── Step 2: Fetch all medical report summaries for this patient stay ─
        const { data: reports, error: reportsError } = await supabase
            .from('medical_reports')
            .select('id, round_id, report_type, ai_summary, created_at')
            .eq(queueIdField, queueId)
            .order('created_at', { ascending: true });

        if (reportsError) throw reportsError;

        // ── Step 3: Build a structured timeline JSON ──────────────────────────
        const now = new Date();
        // ICU uses admission_time, General Ward uses bed_assigned_at or admitted_from_opd_at
        const admittedAt = bedQueueEntry.admission_time || bedQueueEntry.bed_assigned_at || bedQueueEntry.admitted_from_opd_at;
        const admittedDate = admittedAt ? new Date(admittedAt) : now;

        const daysSinceAdmission = Math.round((now - admittedDate) / (1000 * 60 * 60 * 24));

        // Map report summaries by round_id for easy lookup
        const reportsByRound = {};
        for (const r of reports || []) {
            if (!reportsByRound[r.round_id]) reportsByRound[r.round_id] = [];
            if (r.ai_summary) {
                reportsByRound[r.round_id].push({ type: r.report_type, summary: r.ai_summary });
            }
        }

        const timeline = (rounds || []).map((round, idx) => ({
            day: idx + 1,
            date: round.round_date,
            vitals: {
                temperature: round.temperature,
                heart_rate: round.heart_rate,
                blood_pressure: round.blood_pressure,
                oxygen_level: round.oxygen_level,
            },
            condition: round.condition_status,
            doctor_notes: round.doctor_notes,
            reports: reportsByRound[round.id] || [],
        }));

        const patientContext = {
            patient_name: bedQueueEntry.patient_name,
            disease: bedQueueEntry.disease || bedQueueEntry.diseases, // ICU uses plural 'diseases'
            admitted_on: admittedDate.toISOString(),
            current_datetime: now.toISOString(),
            days_since_admission: daysSinceAdmission,
            total_rounds_recorded: timeline.length,
            clinical_timeline: timeline,
        };

        // ── Step 4: Call Gemini API ───────────────────────────────────────────
        const prediction = await callGemini(patientContext);

        // ── Step 5: Save prediction to discharge_predictions ─────────────────
        if (prediction) {
            // Upsert: update if a prediction for this bedQueueId+roundId already exists
            const { error: saveError } = await supabase
                .from('discharge_predictions')
                .upsert([{
                    [queueIdField]: queueId,
                    round_id: currentRoundId,
                    predicted_discharge_date: prediction.predicted_discharge_date || null,
                    remaining_days: prediction.remaining_days != null ? parseInt(prediction.remaining_days) : null,
                    confidence: prediction.confidence != null ? parseFloat(prediction.confidence) : null,
                    reasoning: prediction.reasoning || '',
                }], { onConflict: `${queueIdField},round_id` });

            if (saveError) {
                console.error('Failed to save discharge prediction:', saveError);
            } else {
                // ── Step 6: Sync predicted date back to the primary queue record ──
                const queueTable = isICU ? 'icu_queue' : 'bed_queue';
                const dateColumn = isICU ? 'discharge_time' : 'discharge_time';

                // Note: We update discharge_time so it's reflected on the cards
                const { error: syncError } = await supabase
                    .from(queueTable)
                    .update({
                        [dateColumn]: prediction.predicted_discharge_date
                            ? `${prediction.predicted_discharge_date}T12:00:00Z`
                            : null
                    })
                    .eq('id', queueId);

                if (syncError) {
                    console.error(`Failed to sync discharge_time to ${queueTable}:`, syncError);
                }
            }
        }

        return prediction;
    } catch (err) {
        console.error('Discharge prediction pipeline failed:', err);
        return null;
    }
}

/** 
 * Calls the Gemini API with a structured patient timeline JSON.
 * @param {object} patientContext 
 * @returns {object|null} { predicted_discharge_date, remaining_days, confidence, reasoning }
 */
async function callGemini(patientContext) {
    if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env');
        return null;
    }

    const prompt = `You are a clinical decision-support AI specializing in predicting Remaining Length of Stay (RLOS) for hospitalized patients.

CRITICAL DEFINITION:
- You are predicting REMAINING Length of Stay FROM NOW — NOT total hospital stay.
- If a patient was admitted 3 days ago and will likely need 3 more days, remaining_days = 3.
- predicted_discharge_date must be a FUTURE date relative to current_datetime.
- Reflect the patient's CURRENT trend, not just admission diagnosis.

PATIENT DATA:
${JSON.stringify(patientContext, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Examine the clinical_timeline chronologically for trends in vitals (temperature, heart rate, BP, oxygen), condition status (improving/stable/critical), and doctor notes.
2. Consider AI summaries from lab/radiology reports as objective clinical evidence.
3. Account for days_since_admission — this patient is already ${patientContext.days_since_admission} day(s) into their stay.
4. Base remaining_days on realistic REMAINING recovery time, not total stay.
5. Confidence: 0.0–1.0. Higher when trend is clear and multiple rounds exist; lower when data is sparse.

RESPOND WITH ONLY THIS JSON OBJECT (no markdown, no explanation, just raw JSON):
{
  "predicted_discharge_date": "YYYY-MM-DD",
  "remaining_days": <integer, days remaining from today>,
  "confidence": <float 0.0-1.0>,
  "reasoning": "<concise 2-3 sentence clinical reasoning explaining the estimate>"
}`;

    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: 'application/json',
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Gemini API error:', err);
            return null;
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) return null;

        // Parse JSON — strip markdown code fences if present
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        // Safety: remaining_days must be >= 0
        if (parsed.remaining_days < 0) parsed.remaining_days = 0;

        return parsed;
    } catch (err) {
        console.error('Gemini call or parse failed:', err);
        return null;
    }
}
