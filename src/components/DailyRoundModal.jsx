import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { analyzeMedicalReport } from '../services/aiService';
import { runDischargePrediction } from '../services/dischargePredictionService';

export default function DailyRoundModal({ bed, onClose, onUpdate }) {
    const [loading, setLoading] = useState(false);
    const [predicting, setPredicting] = useState(false);
    const [prediction, setPrediction] = useState(null);
    const [error, setError] = useState('');
    const [files, setFiles] = useState([]);

    const [formData, setFormData] = useState({
        temperature: '',
        heart_rate: '',
        blood_pressure: '',
        oxygen_level: '',
        condition_status: 'stable',
        doctor_notes: ''
    });

    const activeQueue = bed.activeQueue || {};
    const patientName = activeQueue.patient_name || 'Unknown Patient';
    const bedId = bed.bed_id || bed.id;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        setFiles(Array.from(e.target.files));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const bedQueueId = activeQueue.id;
            if (!bedQueueId) {
                throw new Error(`Patient stay information (bed_queue_id) not found for "${patientName}".`);
            }

            // 1. Insert into daily_rounds
            const { data: roundData, error: roundError } = await supabase
                .from('daily_rounds')
                .insert([{
                    bed_queue_id: bedQueueId,
                    bed_id: bedId,
                    temperature: formData.temperature ? parseFloat(formData.temperature) : null,
                    heart_rate: formData.heart_rate ? parseInt(formData.heart_rate) : null,
                    blood_pressure: formData.blood_pressure,
                    oxygen_level: formData.oxygen_level ? parseFloat(formData.oxygen_level) : null,
                    condition_status: formData.condition_status,
                    doctor_notes: formData.doctor_notes
                }])
                .select()
                .single();

            if (roundError) throw roundError;

            // 2. Upload files & run AI report analysis
            if (files.length > 0) {
                for (const file of files) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${bedQueueId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                    const filePath = `rounds/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('medical-records')
                        .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('medical-records')
                        .getPublicUrl(filePath);

                    const reportType = fileExt.toLowerCase() === 'pdf' ? 'scan' : 'xray';

                    const { data: reportData, error: reportError } = await supabase
                        .from('medical_reports')
                        .insert([{
                            bed_queue_id: bedQueueId,
                            round_id: roundData.id,
                            file_url: publicUrl,
                            report_type: reportType
                        }])
                        .select()
                        .single();

                    if (reportError) throw reportError;

                    // Background AI report analysis
                    try {
                        const { summary } = await analyzeMedicalReport(publicUrl, reportType);
                        if (summary) {
                            await supabase
                                .from('medical_reports')
                                .update({ ai_summary: summary })
                                .eq('id', reportData.id);
                        }
                    } catch (aiErr) {
                        console.error('AI Analysis background failed:', aiErr);
                    }
                }
            }

            // 3. Trigger discharge prediction (after all data is saved)
            setPredicting(true);
            setLoading(false);

            const pred = await runDischargePrediction(bedQueueId, roundData.id, activeQueue);
            setPrediction(pred);
            setPredicting(false);

            onUpdate(); // Refresh parent

        } catch (err) {
            console.error('Error saving daily round:', err);
            setError(err.message || 'Failed to save health update.');
            setLoading(false);
            setPredicting(false);
        }
    };

    const confidenceColor = (c) => {
        if (!c) return 'text-slate-500';
        if (c >= 0.75) return 'text-green-600';
        if (c >= 0.5) return 'text-amber-500';
        return 'text-red-500';
    };

    const riskBadge = (days) => {
        if (days == null) return null;
        if (days <= 1) return { label: 'Soon', color: 'bg-green-100 text-green-700' };
        if (days <= 4) return { label: 'Moderate', color: 'bg-amber-100 text-amber-700' };
        return { label: 'Extended', color: 'bg-red-100 text-red-700' };
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white">clinical_notes</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Daily Health Round</h2>
                            <p className="text-xs text-blue-100">Patient: {patientName} • Bed: {bed.bed_number || bedId.slice(0, 8)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Prediction Banner — shown after submit */}
                {(predicting || prediction) && (
                    <div className={`mx-6 mt-6 rounded-xl border p-4 ${predicting ? 'bg-indigo-50 border-indigo-100' : 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200'}`}>
                        {predicting ? (
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined animate-spin text-indigo-500">progress_activity</span>
                                <div>
                                    <p className="text-sm font-bold text-indigo-700">Analyzing patient history…</p>
                                    <p className="text-xs text-indigo-400">Gemini AI is reviewing all rounds & reports</p>
                                </div>
                            </div>
                        ) : prediction ? (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-indigo-600">psychology</span>
                                    <h3 className="text-sm font-bold text-indigo-800">AI Discharge Prediction</h3>
                                    {riskBadge(prediction.remaining_days) && (
                                        <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${riskBadge(prediction.remaining_days).color}`}>
                                            {riskBadge(prediction.remaining_days).label} Stay
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div className="bg-white rounded-xl p-3 shadow-sm text-center">
                                        <p className="text-2xl font-black text-indigo-700">{prediction.remaining_days ?? '—'}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Days Remaining</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 shadow-sm text-center">
                                        <p className="text-sm font-black text-slate-800">{prediction.predicted_discharge_date ?? '—'}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Discharge Date</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 shadow-sm text-center">
                                        <p className={`text-2xl font-black ${confidenceColor(prediction.confidence)}`}>
                                            {prediction.confidence != null ? `${Math.round(prediction.confidence * 100)}%` : '—'}
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Confidence</p>
                                    </div>
                                </div>
                                {prediction.reasoning && (
                                    <p className="text-xs text-slate-600 bg-white/70 rounded-lg p-3 border border-indigo-100 italic leading-relaxed">
                                        💡 {prediction.reasoning}
                                    </p>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Show close button after prediction is done */}
                {prediction && !predicting && (
                    <div className="mx-6 mt-4">
                        <button
                            onClick={onClose}
                            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            Done
                        </button>
                    </div>
                )}

                {/* Form — hidden after prediction is shown */}
                {!prediction && (
                    <form onSubmit={handleSubmit} className="p-6">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Vitals */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500 text-sm">vitals</span>
                                    Patient Vitals
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Temp (°C)</label>
                                        <input type="number" step="0.1" name="temperature" value={formData.temperature} onChange={handleInputChange}
                                            placeholder="36.5" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Heart Rate (BPM)</label>
                                        <input type="number" name="heart_rate" value={formData.heart_rate} onChange={handleInputChange}
                                            placeholder="72" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Blood Pressure</label>
                                        <input type="text" name="blood_pressure" value={formData.blood_pressure} onChange={handleInputChange}
                                            placeholder="120/80" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Oxygen Level (%)</label>
                                        <input type="number" step="0.1" name="oxygen_level" value={formData.oxygen_level} onChange={handleInputChange}
                                            placeholder="98" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Overall Condition</label>
                                    <select name="condition_status" value={formData.condition_status} onChange={handleInputChange}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer">
                                        <option value="improving">Improving</option>
                                        <option value="stable">Stable</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            </div>

                            {/* Notes & Files */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500 text-sm">description</span>
                                    Assessment & Reports
                                </h3>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Doctor Notes</label>
                                    <textarea name="doctor_notes" value={formData.doctor_notes} onChange={handleInputChange}
                                        placeholder="Enter clinical observations, treatment updates..." rows="4"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lab Reports / Documents</label>
                                    <div className="mt-1 flex flex-col gap-2">
                                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-blue-300 transition-all cursor-pointer group">
                                            <div className="flex flex-col items-center justify-center pt-2 pb-2">
                                                <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-500 transition-colors">upload_file</span>
                                                <p className="text-xs text-slate-500 mt-1">Click to upload or drag & drop</p>
                                                <p className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 10MB)</p>
                                            </div>
                                            <input type="file" multiple className="hidden" onChange={handleFileChange} />
                                        </label>
                                        {files.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {files.map((f, i) => (
                                                    <div key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-medium border border-blue-100">
                                                        <span className="truncate max-w-[100px]">{f.name}</span>
                                                        <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>
                                                            <span className="material-symbols-outlined text-xs">close</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex items-center gap-3 pt-6 border-t border-slate-100">
                            <button type="button" onClick={onClose} disabled={loading || predicting}
                                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading || predicting}
                                className="flex-[2] py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                {loading ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                        Saving Record...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[20px]">save</span>
                                        Save & Predict Discharge
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
