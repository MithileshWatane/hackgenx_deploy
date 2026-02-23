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

function formatDate(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function SeverityBadge({ severity }) {
    const cls = {
        critical: 'bg-red-100 text-red-700 border-red-200',
        severe: 'bg-orange-100 text-orange-700 border-orange-200',
        moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    }[severity] || 'bg-slate-100 text-slate-600 border-slate-200';
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${cls}`}>{severity}</span>;
}

const STATUS_COLORS = {
    waiting: 'bg-amber-100 text-amber-800 border-amber-200',
    assigned: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
    discharged: 'bg-blue-100 text-blue-800 border-blue-200',
};

const STATUS_LABEL = {
    waiting: 'Waiting',
    assigned: 'Assigned',
    cancelled: 'Cancelled',
    discharged: 'Discharged',
};

function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
            {STATUS_LABEL[status] || status}
        </span>
    );
}

// ── Scheduling algorithm (same as icuScheduler.js) ────────────────────────────

const findBestBed = (availableBeds, patient) => {
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
};

/**
 * Auto-assigns a freed ICU bed to the oldest waiting patient.
 * Called when an ICU patient is discharged or new bed is added.
 * 
 * @returns {Object} - Assignment result
 */
export async function autoAssignICUBed() {
    try {
        // 1. Find the oldest waiting patient in ICU queue
        const { data: waitingPatients, error } = await supabase
            .from('icu_queue')
            .select('*')
            .eq('status', 'waiting')
            .order('time', { ascending: true }) // Oldest first
            .limit(1);

        if (error) throw error;

        if (!waitingPatients || waitingPatients.length === 0) {
            return { assigned: 0, message: 'No waiting patients in ICU queue' };
        }

        const patient = waitingPatients[0];

        // 2. Find available ICU beds
        const { data: availableBeds, error: bedError } = await supabase
            .from('icu_beds')
            .select('*')
            .eq('is_available', true);

        if (bedError) throw bedError;

        if (!availableBeds || availableBeds.length === 0) {
            return { assigned: 0, message: 'No ICU beds available' };
        }

        // 3. Find the best compatible bed
        const bestBed = findBestBed(availableBeds, patient);

        if (!bestBed) {
            return { assigned: 0, message: 'No compatible ICU bed for waiting patient' };
        }

        // 4. Assign the bed
        const admissionTime = new Date();
        const dischargeTime = new Date(admissionTime);
        dischargeTime.setDate(dischargeTime.getDate() + (patient.predicted_stay_days || 7));

        // Mark bed as occupied
        const { error: bedUpdateError } = await supabase
            .from('icu_beds')
            .update({ is_available: false })
            .eq('id', bestBed.id);

        if (bedUpdateError) throw bedUpdateError;

        // Update patient record
        const { error: queueUpdateError } = await supabase
            .from('icu_queue')
            .update({
                status: 'assigned',
                assigned_bed_id: bestBed.id,
                assigned_bed_label: bestBed.bed_id,
                admission_time: admissionTime.toISOString(),
                discharge_time: dischargeTime.toISOString(),
            })
            .eq('id', patient.id);

        if (queueUpdateError) throw queueUpdateError;

        return {
            assigned: 1,
            patient: patient.patient_name,
            bed: bestBed.bed_id,
            message: `${patient.patient_name} auto-assigned to ICU Bed ${bestBed.bed_id}`
        };

    } catch (error) {
        console.error('Auto-assign ICU bed error:', error);
        return { assigned: 0, message: `Error: ${error.message}` };
    }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ICUQueuePage() {
    const { user } = useAuth();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'waiting' | 'assigned'
    const [updatingId, setUpdatingId] = useState(null);

    const fetchQueue = useCallback(async () => {
        if (!user?.id) { setLoading(false); return; }
        setLoading(true);
        try {
            let query = supabase
                .from('icu_queue')
                .select('*')
                .order('time', { ascending: false });

            // We fetch everything to have accurate counts for all tabs
            // but the 'filtered' variable in the component will handle the view filtering
            const { data, error } = await query;

            if (error) throw error;
            setQueue(data || []);
        } catch (err) {
            console.error('ICU queue fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(fetchQueue, 30000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    const handleManualAssign = async (patient) => {
        if (!window.confirm(`Assign an ICU bed to ${patient.patient_name}?`)) return;
        setUpdatingId(patient.id);
        try {
            const { data: availableBeds, error: bedError } = await supabase
                .from('icu_beds')
                .select('*')
                .eq('is_available', true);

            if (bedError) throw bedError;

            const bestBed = findBestBed(availableBeds || [], patient);

            if (!bestBed) {
                alert('No compatible ICU bed available right now.\nPatient will remain in the waiting queue.');
                return;
            }

            const admissionTime = new Date();
            const dischargeTime = new Date(admissionTime);
            dischargeTime.setDate(dischargeTime.getDate() + (patient.predicted_stay_days || 7));

            const { error: bedUpdateError } = await supabase.from('icu_beds').update({ is_available: false }).eq('id', bestBed.id);
            if (bedUpdateError) throw bedUpdateError;

            const { error: queueUpdateError } = await supabase.from('icu_queue').update({
                status: 'assigned',
                assigned_bed_id: bestBed.id,
                assigned_bed_label: bestBed.bed_id,
                admission_time: admissionTime.toISOString(),
                discharge_time: dischargeTime.toISOString(),
            }).eq('id', patient.id);
            if (queueUpdateError) throw queueUpdateError;

            alert(`✅ ${patient.patient_name} assigned to ICU Bed ${bestBed.bed_id}!`);
            fetchQueue();
        } catch (err) {
            console.error('Assign error:', err);
            alert('Error: ' + err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('Cancel this ICU request?')) return;
        setUpdatingId(id);
        try {
            const { error } = await supabase.from('icu_queue').update({ status: 'cancelled' }).eq('id', id);
            if (error) throw error;
            fetchQueue();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDischarge = async (patient) => {
        if (!window.confirm(`Discharge ${patient.patient_name} from ICU?`)) return;
        setUpdatingId(patient.id);
        try {
            // 1. Free up ICU bed
            if (patient.assigned_bed_id) {
                const { error: bedError } = await supabase
                    .from('icu_beds')
                    .update({ is_available: true })
                    .eq('id', patient.assigned_bed_id);

                if (bedError) throw bedError;
            }

            // 2. Update queue status
            const { error: queueError } = await supabase
                .from('icu_queue')
                .update({
                    status: 'discharged',
                    discharged_at: new Date().toISOString()
                })
                .eq('id', patient.id);

            if (queueError) throw queueError;

            // 3. Try to auto-assign the freed bed to the oldest waiting patient
            const result = await autoAssignICUBed();
            if (result.assigned > 0) {
                alert(`✅ ${patient.patient_name} discharged. ${result.message}`);
            } else {
                alert(`✅ ${patient.patient_name} has been discharged.`);
            }

            fetchQueue();
        } catch (err) {
            console.error('Discharge error:', err);
            alert('Error: ' + err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleRemove = async (patient) => {
        if (!window.confirm(`Remove ${patient.patient_name} from the ICU queue permanently? This action cannot be undone.`)) return;
        setUpdatingId(patient.id);
        try {
            const { error } = await supabase
                .from('icu_queue')
                .delete()
                .eq('id', patient.id);

            if (error) throw error;

            alert(`✅ ${patient.patient_name} has been removed from the queue.`);
            fetchQueue();
        } catch (err) {
            console.error('Remove error:', err);
            alert('Error: ' + err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const stats = {
        waiting: queue.filter(p => p.status === 'waiting').length,
        assigned: queue.filter(p => p.status === 'assigned').length,
        discharged: queue.filter(p => p.status === 'discharged').length,
    };

    const filtered = queue.filter(p => {
        if (activeFilter === 'all') {
            if (p.status === 'discharged') return false;
        } else if (p.status !== activeFilter) {
            return false;
        }

        const q = search.toLowerCase();
        return (
            p.patient_name?.toLowerCase().includes(q) ||
            p.patient_token?.toLowerCase().includes(q) ||
            p.diseases?.toLowerCase().includes(q)
        );
    });

    const FILTERS = [
        { key: 'all', label: 'All Active', count: queue.filter(p => p.status !== 'discharged').length },
        { key: 'waiting', label: 'Waiting', count: stats.waiting },
        { key: 'assigned', label: 'Assigned', count: stats.assigned },
        { key: 'discharged', label: 'Discharged', count: stats.discharged },
    ];

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f8]">
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">ICU Bed Queue</h1>
                    <p className="text-xs text-slate-500">Critical Care Transfer Requests — Auto-Assignment Enabled</p>
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
                    <button onClick={fetchQueue} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                {/* Stats Cards */}
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[
                        { label: 'Waiting', count: stats.waiting, icon: 'hourglass_empty', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
                        { label: 'Assigned', count: stats.assigned, icon: 'check_circle', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
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

                {/* Filter Tabs */}
                <div className="mb-4 flex items-center gap-2 overflow-x-auto">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setActiveFilter(f.key)}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeFilter === f.key ? 'bg-red-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            {f.label}
                            {f.count !== null && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{f.count}</span>}
                        </button>
                    ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-red-50/50 to-transparent">
                        <h2 className="font-bold text-slate-800">ICU Request List</h2>
                        <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">{filtered.length} Requests</span>
                    </div>

                    {loading && queue.length === 0 ? (
                        <div className="flex items-center justify-center py-20">
                            <span className="material-symbols-outlined animate-spin text-slate-300 text-4xl">progress_activity</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-20 text-center">
                            <span className="material-symbols-outlined text-6xl text-slate-300 block mb-4">monitor_heart</span>
                            <p className="text-slate-500 text-lg font-medium">No ICU requests found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50/50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-4">Patient</th>
                                        <th className="px-5 py-4">Diagnosis/Surgery</th>
                                        <th className="px-5 py-4">Needs/Severity</th>
                                        <th className="px-5 py-4">Wait Time</th>
                                        <th className="px-5 py-4 text-center">Status / Bed</th>
                                        <th className="px-5 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((p) => (
                                        <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${p.status === 'assigned' ? 'bg-green-50/20' : ''}`}>
                                            <td className="px-5 py-4">
                                                <div className="font-bold text-slate-900">{p.patient_name}</div>
                                                <div className="font-mono text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded w-fit mt-1">{p.patient_token || p.id.slice(0, 8)}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-slate-900 font-medium">{p.diseases}</p>
                                                {p.surgery_type && <p className="text-[10px] text-slate-500 italic mt-0.5">{p.surgery_type}</p>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {p.ventilator_needed && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">Vent</span>}
                                                        {p.dialysis_needed && <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">Dial</span>}
                                                    </div>
                                                    <SeverityBadge severity={p.severity} />
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                {p.status === 'discharged' ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-700">Discharged</span>
                                                        <span className="text-[10px] text-slate-500">{formatDate(p.discharged_at)}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="text-xs font-bold text-slate-700">{timeSince(p.time)}</div>
                                                        <div className="text-[10px] text-slate-400">{timeAgo(p.time)}</div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <StatusBadge status={p.status} />
                                                    {p.status === 'assigned' && p.assigned_bed_label && (
                                                        <div className="flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                                            <span className="material-symbols-outlined text-[14px] text-red-600">bed</span>
                                                            <span className="text-xs font-bold text-red-600">{p.assigned_bed_label}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {p.status === 'waiting' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleCancel(p.id)}
                                                                disabled={updatingId === p.id}
                                                                className="p-1 text-slate-400 hover:text-red-500 transition-all hover:scale-110"
                                                                title="Cancel request"
                                                            >
                                                                <span className="material-symbols-outlined text-xl">block</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleManualAssign(p)}
                                                                disabled={updatingId === p.id}
                                                                className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                                                            >
                                                                {updatingId === p.id ? (
                                                                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                                )}
                                                                Assign Bed
                                                            </button>
                                                        </>
                                                    )}
                                                    {p.status === 'assigned' && (
                                                        <div className="flex flex-col items-end gap-2">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                                    Assigned
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 mt-1">Est. discharge: {formatDate(p.discharge_time)}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDischarge(p)}
                                                                disabled={updatingId === p.id}
                                                                className="bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">logout</span>
                                                                Discharge
                                                            </button>
                                                        </div>
                                                    )}
                                                    {p.status === 'discharged' && (
                                                        <button
                                                            onClick={() => handleRemove(p)}
                                                            disabled={updatingId === p.id}
                                                            className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                                                        >
                                                            {updatingId === p.id ? (
                                                                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                                            ) : (
                                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                            )}
                                                            Remove
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
