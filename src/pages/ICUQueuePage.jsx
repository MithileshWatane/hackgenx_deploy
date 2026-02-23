import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext_simple';
import { supabase } from '../lib/supabase';
import NearbyHospitalsModal from '../components/NearbyHospitalsModal';
import PatientNearbyHospitals from '../components/PatientNearbyHospitals';

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
    const config = {
        critical: { bg: 'bg-white', text: 'text-red-600', border: 'border-transparent', icon: 'error' },
        severe: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', icon: 'warning' },
        moderate: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: 'info' },
    }[severity] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: 'info' };

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${config.border} ${config.bg} ${config.text}`}>
            <span className="material-symbols-outlined text-[12px]">{config.icon}</span>
            {severity}
        </span>
    );
}

const STATUS_COLORS = {
    waiting: 'bg-amber-400 text-white',
    assigned: 'bg-emerald-500 text-white',
    cancelled: 'bg-slate-300 text-slate-700',
    discharged: 'bg-blue-500 text-white',
};

const STATUS_LABEL = {
    waiting: 'Waiting',
    assigned: 'Assigned',
    cancelled: 'Cancelled',
    discharged: 'Discharged',
};

function StatusBadge({ status }) {
    const label = STATUS_LABEL[status] || status;
    const colorClass = STATUS_COLORS[status] || 'bg-slate-200 text-slate-700';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${colorClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-white/80`} />
            {label}
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
 * Auto-assigns a freed ICU bed to the oldest waiting patient of the specified doctor.
 * Called when an ICU patient is discharged or new bed is added.
 * 
 * @param {string} doctorId - The doctor ID to filter by
 * @returns {Object} - Assignment result
 */
export async function autoAssignICUBed(doctorId) {
    try {
        // 1. Find the oldest waiting patient in ICU queue for this doctor
        let patientQuery = supabase
            .from('icu_queue')
            .select('*')
            .eq('status', 'waiting')
            .order('time', { ascending: true }) // Oldest first
            .limit(1);

        // Filter by doctor if provided
        if (doctorId) {
            patientQuery = patientQuery.eq('doctor_id', doctorId);
        }

        const { data: waitingPatients, error } = await patientQuery;

        if (error) throw error;

        if (!waitingPatients || waitingPatients.length === 0) {
            return { assigned: 0, message: 'No waiting patients in ICU queue' };
        }

        const patient = waitingPatients[0];

        // 2. Find available ICU beds for this doctor
        let bedQuery = supabase
            .from('icu_beds')
            .select('*')
            .eq('is_available', true);

        // Filter by doctor if provided - use patient's doctor or the passed doctorId
        const bedDoctorId = doctorId || patient.doctor_id;
        if (bedDoctorId) {
            bedQuery = bedQuery.eq('doctor_id', bedDoctorId);
        }

        const { data: availableBeds, error: bedError } = await bedQuery;

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

    // Nearby hospitals modal state
    const [showNearbyHospitals, setShowNearbyHospitals] = useState(false);
    const [selectedPatientForReferral, setSelectedPatientForReferral] = useState(null);

    const fetchQueue = useCallback(async () => {
        if (!user?.id) { setLoading(false); return; }
        setLoading(true);
        try {
            let query = supabase
                .from('icu_queue')
                .select('*')
                .eq('doctor_id', user.id)  // Filter by current doctor
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
            // Only fetch available beds belonging to the current doctor
            const { data: availableBeds, error: bedError } = await supabase
                .from('icu_beds')
                .select('*')
                .eq('is_available', true)
                .eq('doctor_id', user.id);  // Filter by current doctor

            if (bedError) throw bedError;

            const bestBed = findBestBed(availableBeds || [], patient);

            if (!bestBed) {
                setSelectedPatientForReferral(patient);
                setShowNearbyHospitals(true);
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

            // 3. Try to auto-assign the freed bed to the oldest waiting patient of this doctor
            const result = await autoAssignICUBed(user.id);
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
    }).sort((a, b) => {
        // Sort emergency patients to the top
        if (a.is_emergency && !b.is_emergency) return -1;
        if (!a.is_emergency && b.is_emergency) return 1;
        // Then sort by time (most recent first)
        return new Date(b.time) - new Date(a.time);
    });

    const FILTERS = [
        { key: 'all', label: 'All Active', count: queue.filter(p => p.status !== 'discharged').length },
        { key: 'waiting', label: 'Waiting', count: stats.waiting },
        { key: 'assigned', label: 'Assigned', count: stats.assigned },
        { key: 'discharged', label: 'Discharged', count: stats.discharged },
    ];

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f8]">
            <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-white to-slate-50 px-8">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-200">
                        <span className="material-symbols-outlined text-2xl">monitor_heart</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">ICU Bed Queue</h1>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Critical Care Transfer Requests — Auto-Assignment Enabled
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Nearby Hospitals Button */}
                    <button
                        onClick={() => setShowNearbyHospitals(true)}
                        className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-md shadow-blue-200 hover:shadow-lg hover:scale-105 transition-all text-sm font-semibold"
                        title="Check nearby hospitals with available ICU beds"
                    >
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        Nearby Hospitals
                    </button>

                    <div className="hidden md:flex items-center rounded-xl bg-white border border-slate-200 px-4 py-2.5 shadow-sm focus-within:shadow-md focus-within:border-blue-300 transition-all">
                        <span className="material-symbols-outlined text-slate-400">search</span>
                        <input
                            className="ml-3 w-56 bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                            placeholder="Search patient or token..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={fetchQueue}
                        className="rounded-xl p-2.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm hover:shadow-md"
                        title="Refresh queue"
                    >
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {/* Stats Cards */}
                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100 rounded-full -mr-8 -mt-8 opacity-50"></div>
                        <div className="relative flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md shadow-amber-200">
                                <span className="material-symbols-outlined text-2xl">hourglass_empty</span>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-slate-900">{stats.waiting}</p>
                                <p className="text-sm font-semibold text-amber-600">Waiting Patients</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 rounded-full -mr-8 -mt-8 opacity-50"></div>
                        <div className="relative flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-md shadow-emerald-200">
                                <span className="material-symbols-outlined text-2xl">check_circle</span>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-slate-900">{stats.assigned}</p>
                                <p className="text-sm font-semibold text-emerald-600">Assigned Beds</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100 rounded-full -mr-8 -mt-8 opacity-50"></div>
                        <div className="relative flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-slate-400 to-slate-500 text-white shadow-md shadow-slate-200">
                                <span className="material-symbols-outlined text-2xl">bed</span>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-slate-900">{stats.assigned + stats.waiting}</p>
                                <p className="text-sm font-semibold text-slate-600">Total Active</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setActiveFilter(f.key)}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${activeFilter === f.key
                                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm shadow-red-200 scale-105'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                        >
                            <span className="material-symbols-outlined text-sm">
                                {f.key === 'all' ? 'groups' : f.key === 'waiting' ? 'hourglass_empty' : f.key === 'assigned' ? 'check_circle' : 'logout'}
                            </span>
                            {f.label}
                            {f.count !== null && (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                    {f.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Main Table Card */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-3.5 border-b border-slate-200 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                                <span className="material-symbols-outlined">format_list_bulleted</span>
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 text-lg">ICU Request List</h2>
                                <p className="text-xs text-slate-500">Manage patient bed assignments</p>
                            </div>
                        </div>
                        <span className="px-4 py-2 bg-slate-100 rounded-full text-sm font-semibold text-slate-600">
                            {filtered.length} {filtered.length === 1 ? 'Request' : 'Requests'}
                        </span>
                    </div>

                    {loading && queue.length === 0 ? (
                        <div className="flex items-center justify-center py-20">
                            <span className="material-symbols-outlined animate-spin text-slate-300 text-4xl">progress_activity</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-24 text-center">
                            <div className="flex justify-center mb-6">
                                <div className="h-24 w-24 rounded-full bg-slate-50 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-5xl text-slate-300">monitor_heart</span>
                                </div>
                            </div>
                            <p className="text-slate-400 text-xl font-semibold mb-2">No ICU requests found</p>
                            <p className="text-slate-400 text-sm">All patients have been assigned or discharged</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Patient Details</th>
                                        <th className="px-4 py-3 font-semibold">Medical Info</th>
                                        <th className="px-4 py-3 font-semibold">Requirements</th>
                                        <th className="px-4 py-3 font-semibold">Timeline</th>
                                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((p) => (
                                        <React.Fragment key={p.id}>
                                            <tr className={`transition-colors ${
                                                p.is_emergency 
                                                    ? 'bg-red-50 border-l-4 border-l-red-500' 
                                                    : p.status === 'assigned' 
                                                        ? 'bg-emerald-50/30' 
                                                        : 'hover:bg-slate-50'
                                            }`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-10 w-10 rounded-full ${
                                                            p.is_emergency 
                                                                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' 
                                                                : 'bg-gradient-to-br from-red-100 to-red-50 text-red-600'
                                                        } flex items-center justify-center font-bold text-sm relative`}>
                                                            {p.is_emergency && (
                                                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                                                </span>
                                                            )}
                                                            {p.patient_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-900 text-sm">{p.patient_name}</span>
                                                                {p.is_emergency && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full animate-pulse">
                                                                        EMERGENCY
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit mt-1">{p.patient_token || p.id.slice(0, 8)}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="text-slate-700 font-medium text-sm">{p.diseases}</p>
                                                    {p.surgery_type && <p className="text-xs text-slate-400 mt-1">{p.surgery_type}</p>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {p.ventilator_needed && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-md font-bold">
                                                                    <span className="material-symbols-outlined text-[12px]">air</span>
                                                                    Vent
                                                                </span>
                                                            )}
                                                            {p.dialysis_needed && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded-md font-bold">
                                                                    <span className="material-symbols-outlined text-[12px]">water_drop</span>
                                                                    Dialysis
                                                                </span>
                                                            )}
                                                        </div>
                                                        <SeverityBadge severity={p.severity} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {p.status === 'discharged' ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700">Discharged</span>
                                                            <span className="text-xs text-slate-400">{formatDate(p.discharged_at)}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-800">{timeSince(p.time)}</span>
                                                            <span className="text-xs text-slate-400">{timeAgo(p.time)}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <StatusBadge status={p.status} />
                                                        {p.status === 'assigned' && p.assigned_bed_label && (
                                                            <div className="flex items-center gap-1.5 bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                                                                <span className="material-symbols-outlined text-sm text-red-500">bed</span>
                                                                <span className="text-xs font-bold text-red-600">{p.assigned_bed_label}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {p.status === 'waiting' && (
                                                            <button
                                                                onClick={() => handleManualAssign(p)}
                                                                disabled={updatingId === p.id}
                                                                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:shadow-md hover:shadow-red-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                                            >
                                                                {updatingId === p.id ? (
                                                                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                                )}
                                                                Assign
                                                            </button>
                                                        )}
                                                        {p.status === 'assigned' && (
                                                            <div className="flex flex-col items-end gap-2">
                                                                <div className="flex items-center gap-1.5 text-emerald-600">
                                                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                                                    <span className="text-sm font-bold">Assigned</span>
                                                                </div>
                                                                <span className="text-xs text-slate-400">Est. discharge: {formatDate(p.discharge_time)}</span>
                                                                <button
                                                                    onClick={() => handleDischarge(p)}
                                                                    disabled={updatingId === p.id}
                                                                    className="mt-1 bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold hover:shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
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
                                                                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:shadow-md hover:shadow-red-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
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
                                            {/* Show nearby hospitals inline for waiting patients */}
                                            {p.status === 'waiting' && (
                                                <tr className="bg-gradient-to-r from-blue-50/50 to-white border-b border-slate-100">
                                                    <td colSpan="6" className="px-4 py-2">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="material-symbols-outlined text-blue-500 text-sm">location_on</span>
                                                            <span className="text-sm font-semibold text-blue-700">Nearby Hospitals with Available Beds:</span>
                                                        </div>
                                                        <PatientNearbyHospitals patient={p} />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Nearby Hospitals Modal */}
            <NearbyHospitalsModal
                isOpen={showNearbyHospitals}
                onClose={() => {
                    setShowNearbyHospitals(false);
                    setSelectedPatientForReferral(null);
                }}
                patientRequirements={{
                    needsVentilator: selectedPatientForReferral?.ventilator_needed,
                    needsDialysis: selectedPatientForReferral?.dialysis_needed
                }}
            />
        </div>
    );
}
