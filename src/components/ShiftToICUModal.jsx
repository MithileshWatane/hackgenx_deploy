import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext_simple';

export default function ShiftToICUModal({ patient, onClose, onShift }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        patient_token: patient?.token_number || '',
        patient_name: patient?.patient_name || '',
        diseases: patient?.disease || patient?.diseases || '',
        surgery_type: '',
        bed_type: 'icu',
        severity: 'critical',
        is_emergency: true,
        predicted_stay_days: 7,
        ventilator_needed: false,
        dialysis_needed: false,
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase
                .from('icu_queue')
                .insert([{
                    ...formData,
                    doctor_id: user?.id,
                    original_bed_id: patient?.original_bed_id || null,
                    time: new Date().toISOString(),
                    status: 'waiting'
                }]);

            if (error) throw error;
            onShift();
            onClose();
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Is Emergency</label>
                            <select value={formData.is_emergency} onChange={e => setFormData({ ...formData, is_emergency: e.target.value === 'true' })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none">
                                <option value="true">Yes (Emergency)</option>
                                <option value="false">No (Planned)</option>
                            </select>
                        </div>
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
        </div>
    );
}
