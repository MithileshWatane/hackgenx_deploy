import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext_simple';
import { supabase } from '../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoString) {
    if (!isoString) return '—';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const h = Math.floor(diffMin / 60);
    return `${h}h ${diffMin % 60}m ago`;
}

function timeSince(isoString) {
    if (!isoString) return '—';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '<1 min';
    if (diffMin < 60) return `${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    return `${h}h ${diffMin % 60}m`;
}

const BED_TYPE_COLORS = {
    icu: 'bg-red-100 text-red-700 border-red-200',
    emergency: 'bg-orange-100 text-orange-700 border-orange-200',
    general: 'bg-blue-100 text-blue-700 border-blue-200',
    private: 'bg-purple-100 text-purple-700 border-purple-200',
    maternity: 'bg-pink-100 text-pink-700 border-pink-200',
};

const STATUS_COLORS = {
    waiting_for_bed: 'bg-amber-100 text-amber-800',
    bed_assigned: 'bg-blue-100 text-blue-800',
    admitted: 'bg-green-100 text-green-800',
    discharged: 'bg-slate-100 text-slate-600',
};

const STATUS_LABEL = {
    waiting_for_bed: 'Waiting for Bed',
    bed_assigned: 'Bed Assigned',
    admitted: 'Admitted',
    discharged: 'Discharged',
};

function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
            {STATUS_LABEL[status] || status}
        </span>
    );
}

// ── Assign Bed Modal ──────────────────────────────────────────────────────────

function AssignBedModal({ patient, onClose, onAssign, assigning }) {
    const [availableBeds, setAvailableBeds] = useState([]);
    const [selectedBedId, setSelectedBedId] = useState('');
    const [loadingBeds, setLoadingBeds] = useState(true);
    const [error, setError] = useState('');

    const ESTIMATED_STAY = '1 day';

    useEffect(() => {
        const fetchAvailableBeds = async () => {
            setLoadingBeds(true);
            try {
                const { data, error: fetchError } = await supabase
                    .from('beds')
                    .select('*')
                    .eq('status', 'available')
                    .order('bed_number', { ascending: true });

                if (fetchError) throw fetchError;
                setAvailableBeds(data || []);
            } catch (err) {
                console.error('Fetch available beds error:', err);
                setError('Failed to load available beds.');
            } finally {
                setLoadingBeds(false);
            }
        };
        fetchAvailableBeds();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedBedId) { setError('Please select a bed.'); return; }
        const bed = availableBeds.find(b => b.id === selectedBedId);
        onAssign({ bedId: bed.id, bedType: bed.bed_type, bedNumber: bed.bed_number });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#2b8cee]/5 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#2b8cee]/10 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[#2b8cee] text-xl">bed</span>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Assign Bed</h2>
                            <p className="text-xs text-slate-500 truncate max-w-[220px]">Patient: <span className="font-semibold text-slate-700">{patient.patient_name}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={assigning} className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-slate-100 transition-colors disabled:opacity-50">
                        <span className="material-symbols-outlined text-slate-500 text-xl">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <span className="material-symbols-outlined text-amber-500">person</span>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{patient.patient_name}</p>
                            <p className="text-xs text-slate-500">{patient.disease} • Token: <span className="font-mono font-semibold text-[#2b8cee]">{patient.token_number || '—'}</span></p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <span className="material-symbols-outlined text-[#2b8cee] text-xl">schedule</span>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Estimated Stay</p>
                            <p className="text-base font-bold text-[#2b8cee]">{ESTIMATED_STAY}</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                            Select Available Bed <span className="text-red-500">*</span>
                        </label>
                        {loadingBeds ? (
                            <div className="flex items-center justify-center py-4">
                                <span className="material-symbols-outlined animate-spin text-slate-300">progress_activity</span>
                            </div>
                        ) : availableBeds.length === 0 ? (
                            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                No available beds in the system. Add beds in Bed Management.
                            </div>
                        ) : (
                            <select
                                value={selectedBedId}
                                onChange={(e) => { setSelectedBedId(e.target.value); setError(''); }}
                                disabled={assigning}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/30 focus:border-[#2b8cee] transition-all bg-white"
                            >
                                <option value="">Select a bed...</option>
                                {availableBeds.map(bed => (
                                    <option key={bed.id} value={bed.id}>
                                        {bed.bed_number} ({bed.bed_type.toUpperCase()})
                                    </option>
                                ))}
                            </select>
                        )}
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={assigning}
                            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >Cancel</button>
                        <button
                            type="submit"
                            disabled={assigning || availableBeds.length === 0}
                            className="flex-1 py-2.5 rounded-lg bg-[#2b8cee] hover:bg-blue-600 text-white text-sm font-bold shadow-md shadow-[#2b8cee]/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {assigning ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                            {assigning ? 'Assigning…' : 'Confirm Assignment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BedQueuePage() {
    const { user } = useAuth();
    const [bedQueue, setBedQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [updatingId, setUpdatingId] = useState(null);
    const [assignModalPatient, setAssignModalPatient] = useState(null);
    const [assigning, setAssigning] = useState(false);

    const fetchBedQueue = useCallback(async () => {
        if (!user?.id) { setLoading(false); return; }
        setLoading(true);
        try {
            let query = supabase
                .from('bed_queue')
                .select('*')
                .eq('doctor_id', user.id)
                .order('admitted_from_opd_at', { ascending: true });

            if (activeFilter !== 'all') {
                query = query.eq('status', activeFilter);
            } else {
                query = query.neq('status', 'discharged');
            }

            const { data } = await query;
            setBedQueue(data || []);
        } catch (err) {
            console.error('Bed queue fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, activeFilter]);

    useEffect(() => {
        fetchBedQueue();
        const interval = setInterval(fetchBedQueue, 30000);
        return () => clearInterval(interval);
    }, [fetchBedQueue]);

    const handleUpdateStatus = async (entry, newStatus) => {
        const labels = { admitted: 'Mark as Admitted', discharged: 'Discharge' };
        if (!window.confirm(`${labels[newStatus] || newStatus} for ${entry.patient_name}?`)) return;

        setUpdatingId(entry.id);
        try {
            const updates = { status: newStatus };
            if (newStatus === 'admitted') updates.admitted_at = new Date().toISOString();
            if (newStatus === 'discharged') {
                const now = new Date().toISOString();
                updates.discharged_at = now;

                // If discharged, we should also free up the bed
                if (entry.bed_id) {
                    const { error: bedError } = await supabase
                        .from('beds')
                        .update({ status: 'available' })
                        .eq('id', entry.bed_id);

                    if (bedError) {
                        console.error('Error freeing bed on discharge:', bedError);
                        // We continue with queue update even if bed update fails, but log it
                    }
                }
            }

            const { error: updateError } = await supabase
                .from('bed_queue')
                .update(updates)
                .eq('id', entry.id);

            if (updateError) throw updateError;

            // If admitted, we should update the admission record too
            // This logic can be expanded...

            await fetchBedQueue();
        } catch (err) {
            console.error('Update status error:', err);
            alert('Failed to update: ' + err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleAssignBedFromModal = async ({ bedId, bedType, bedNumber }) => {
        if (!assignModalPatient) return;
        setAssigning(true);
        try {
            // 1. Update Bed Queue
            const now = new Date().toISOString();
            const { error: queueError } = await supabase
                .from('bed_queue')
                .update({
                    status: 'admitted', // Directly mark as admitted
                    bed_assigned_at: now,
                    admitted_at: now,   // Also set admitted_at
                    bed_type: bedType,
                    bed_id: bedId, // Using the bed UUID
                    notes: `Bed Number: ${bedNumber}`
                })
                .eq('id', assignModalPatient.id);

            if (queueError) throw queueError;

            // 2. Update Bed Status to occupied
            const { error: bedError } = await supabase
                .from('beds')
                .update({
                    status: 'occupied',
                    // Normally we'd link patient_id here too if we have it
                    // patient_id: assignModalPatient.patient_id 
                })
                .eq('id', bedId);

            if (bedError) throw bedError;

            // 3. Create Admission Record
            // We need patient_id but bed_queue might not have it directly if it was just text
            // In a better system, bed_queue would have patient_id

            setAssignModalPatient(null);
            await fetchBedQueue();
        } catch (err) {
            console.error('Assign bed error:', err);
            alert('Failed to assign bed: ' + err.message);
        } finally {
            setAssigning(false);
        }
    };

    const filtered = bedQueue.filter(p =>
        p.patient_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.token_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.disease || '').toLowerCase().includes(search.toLowerCase())
    );

    const stats = {
        waiting: bedQueue.filter(p => p.status === 'waiting_for_bed').length,
        assigned: bedQueue.filter(p => p.status === 'bed_assigned').length,
        admitted: bedQueue.filter(p => p.status === 'admitted').length,
    };

    const FILTERS = [
        { key: 'all', label: 'Active', count: bedQueue.length },
        { key: 'waiting_for_bed', label: 'Waiting', count: stats.waiting },
        { key: 'admitted', label: 'Admitted', count: stats.admitted },
        { key: 'discharged', label: 'Discharged', count: null },
    ];

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f8]">
            {assignModalPatient && (
                <AssignBedModal
                    patient={assignModalPatient}
                    onClose={() => !assigning && setAssignModalPatient(null)}
                    onAssign={handleAssignBedFromModal}
                    assigning={assigning}
                />
            )}

            <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Bed Queue</h1>
                    <p className="text-xs text-slate-500">Admitted from OPD — Pending Bed Assignment</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center rounded-lg bg-slate-100 px-3 py-2">
                        <span className="material-symbols-outlined text-slate-400">search</span>
                        <input
                            className="ml-2 w-48 bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                            placeholder="Search name or token..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={fetchBedQueue} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#2b8cee]">
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[
                        { label: 'Waiting', count: stats.waiting, icon: 'hourglass_empty', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
                        { label: 'Admitted', count: stats.admitted, icon: 'check_circle', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
                    ].map((s) => (
                        <div key={s.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${s.iconBg} ${s.iconColor}`}>
                                <span className="material-symbols-outlined">{s.icon}</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{s.count}</p>
                                <p className="text-sm font-semibold text-slate-700">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mb-4 flex items-center gap-2 overflow-x-auto">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setActiveFilter(f.key)}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeFilter === f.key ? 'bg-[#2b8cee] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            {f.label}
                            {f.count !== null && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{f.count}</span>}
                        </button>
                    ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="font-bold text-slate-800">Queue List</h2>
                        <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">{filtered.length} Patients</span>
                    </div>

                    {loading && bedQueue.length === 0 ? (
                        <div className="flex items-center justify-center py-20">
                            <span className="material-symbols-outlined animate-spin text-slate-300 text-4xl">progress_activity</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-4">Patient</th>
                                        <th className="px-5 py-4">Disease</th>
                                        <th className="px-5 py-4">Bed Info</th>
                                        <th className="px-5 py-4">Time Waiting</th>
                                        <th className="px-5 py-4 text-center">Status</th>
                                        <th className="px-5 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="font-bold text-slate-900">{p.patient_name}</div>
                                                <div className="font-mono text-[10px] text-[#2b8cee] bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-1">{p.token_number || p.id.slice(0, 8)}</div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-600 font-medium">{p.disease}</td>
                                            <td className="px-5 py-4">
                                                {p.status === 'waiting_for_bed' ? (
                                                    <span className="text-slate-400 italic text-xs">Unassigned</span>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border w-fit ${BED_TYPE_COLORS[p.bed_type] || 'bg-slate-100 text-slate-600'}`}>{p.bed_type}</span>
                                                        <span className="text-xs font-bold text-slate-700">{p.notes?.split(': ')[1] || 'Admitted'}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-xs font-bold text-slate-700">{timeSince(p.admitted_from_opd_at)}</div>
                                                <div className="text-[10px] text-slate-400">{timeAgo(p.admitted_from_opd_at)}</div>
                                            </td>
                                            <td className="px-5 py-4 text-center"><StatusBadge status={p.status} /></td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {p.status === 'waiting_for_bed' && (
                                                        <button onClick={() => setAssignModalPatient(p)} className="bg-[#2b8cee] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-sm">bed</span> Assign
                                                        </button>
                                                    )}
                                                    {p.status === 'bed_assigned' && (
                                                        <span className="text-xs text-slate-400 italic px-3">Pending Admit...</span>
                                                    )}
                                                    {p.status === 'admitted' && (
                                                        <button onClick={() => handleUpdateStatus(p, 'discharged')} className="bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-sm">logout</span> Discharge
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
