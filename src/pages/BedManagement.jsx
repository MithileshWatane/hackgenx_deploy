import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Bed Card ──────────────────────────────────────────────────────────────────

function BedCard({ bed, onUpdate, onDischarge }) {
    const { bed_id, id, bed_number, status, patient, admission, notes } = bed;
    
    // Use bed_id if available, fallback to id
    const bedId = bed_id || id;

    // Map database status to UI format
    const displayId = bed_number || bedId?.slice(0, 8);

    // Helpers for admission data
    const timeAgo = (isoString) => {
        if (!isoString) return '';
        const diffMs = Date.now() - new Date(isoString).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        return 'recently';
    };

    const getTimeLeft = (isoString) => {
        if (!isoString) return '~1d left';
        const diffMs = new Date(isoString).getTime() - Date.now();
        if (diffMs < 0) return 'Overdue';
        const h = Math.floor(diffMs / (1000 * 60 * 60));
        if (h > 24) return `~${Math.floor(h / 24)}d left`;
        return `~${h}h left`;
    };

    const isICU = bed.bed_type === 'icu';
    const isGeneral = bed.bed_type === 'general';

    if (status === 'available') {
        const bgColor = isICU ? 'bg-yellow-500' : 'bg-green-500';
        const borderColor = isICU ? 'hover:border-yellow-500/50' : 'hover:border-green-500/50';
        const badgeColor = isICU ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
        const iconColor = isICU ? 'group-hover:text-yellow-500' : 'group-hover:text-green-500';
        const btnColor = isICU ? 'text-yellow-600 border-yellow-200 hover:bg-yellow-500' : 'text-green-600 border-green-200 hover:bg-green-500';

        return (
            <div className={`group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md ${borderColor} transition-all cursor-pointer relative overflow-hidden flex flex-col h-full`}>
                <div className={`h-1 ${bgColor} w-full absolute top-0`} />
                <div className="p-4 flex flex-col h-full justify-between">
                    <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900 text-lg">{displayId}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badgeColor}`}>Available</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center my-4">
                        <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 transition-colors mr-2">
                            <span className="material-symbols-outlined text-2xl">{isICU ? 'monitor_heart' : 'bed'}</span>
                        </div>
                        <div className={`size-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 ${iconColor} transition-colors`}>
                            <span className="material-symbols-outlined text-2xl">bed</span>
                        </div>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                        <button className={`w-full py-1.5 rounded text-sm font-medium ${btnColor} hover:text-white transition-colors`}>Assign Patient</button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'cleaning' || status === 'maintenance') return (
        <div className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-yellow-500/50 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full opacity-80">
            <div className="h-1 bg-yellow-500 w-full absolute top-0" />
            <div className="p-4 flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-900 text-lg">{displayId}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">{status === 'cleaning' ? 'Cleaning' : 'Maintenance'}</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center my-4 text-center">
                    <span className="material-symbols-outlined text-3xl text-yellow-500/70 mb-2">{status === 'cleaning' ? 'cleaning_services' : 'build'}</span>
                    <p className="text-xs text-slate-500 whitespace-pre-line">{notes || 'In progress...'}</p>
                </div>
                <div className="pt-3 border-t border-slate-100">
                    <button
                        onClick={() => onUpdate(bedId, 'available')}
                        className="w-full py-1.5 rounded text-sm font-medium text-slate-600 border border-slate-200 hover:bg-green-500 hover:text-white hover:border-green-500 transition-colors"
                    >Mark as Ready</button>
                </div>
            </div>
        </div>
    );

    // For occupied/critical beds, get patient info from bed_queue
    const q = bed.activeQueue;

    if (status === 'critical' || (status === 'occupied' && isICU)) return (
        <div className="group bg-white rounded-xl border border-red-200 shadow-sm hover:shadow-md hover:border-red-400 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full ring-2 ring-red-50">
            <div className="h-1 bg-red-500 w-full absolute top-0" />
            <div className="p-4 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-slate-900 text-lg">{displayId}</span>
                    <div className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">{status === 'critical' ? 'priority_high' : 'monitor_heart'}</span>
                        {status === 'critical' ? 'Critical' : 'Occupied (ICU)'}
                    </div>
                </div>
                <h4 className="text-sm font-semibold text-slate-900">{q?.patient_name || '—'}</h4>
                <p className="text-xs text-slate-500">
                    {q?.disease && <span className="font-medium">{q.disease}</span>}
                    {q?.bed_assigned_at && <span> • Adm: {timeAgo(q.bed_assigned_at)}</span>}
                </p>
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                        <span className="material-symbols-outlined text-sm">monitor_heart</span>
                        <span>{status === 'critical' ? 'Critical Monitoring' : 'ICU Monitoring'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onDischarge(bedId); }}
                            className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-600 hover:text-white transition-colors border border-red-100"
                        >Discharge</button>
                        <button className="text-slate-400 hover:text-[#2b8cee] transition-colors"><span className="material-symbols-outlined">more_vert</span></button>
                    </div>
                </div>
            </div>
        </div>
    );

    // occupied (General or others) — Blue
    return (
        <div className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#2b8cee]/50 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full">
            <div className="h-1 bg-[#2b8cee] w-full absolute top-0" />
            <div className="p-4 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-slate-900 text-lg">{displayId}</span>
                    <div className="px-2 py-0.5 rounded text-xs font-semibold bg-[#2b8cee]/10 text-[#2b8cee] flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-[#2b8cee] animate-pulse inline-block" />
                        Occupied{isGeneral ? ' (General)' : ''}
                    </div>
                </div>
                <h4 className="text-sm font-semibold text-slate-900">{q?.patient_name || '—'}</h4>
                <p className="text-xs text-slate-500">
                    {q?.disease && <span className="font-medium">{q.disease}</span>}
                    {q?.bed_assigned_at && <span> • Adm: {timeAgo(q.bed_assigned_at)}</span>}
                </p>
                {notes && <p className="text-xs font-medium text-slate-700 mt-2 bg-slate-50 p-1.5 rounded inline-block">Note: {notes}</p>}
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        <span>~1d left</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onDischarge(bedId); }}
                            className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#2b8cee] px-2 py-1 rounded hover:bg-[#2b8cee] hover:text-white transition-colors border border-[#2b8cee]/20"
                        >Discharge</button>
                        <button className="text-slate-400 hover:text-[#2b8cee] transition-colors"><span className="material-symbols-outlined">more_vert</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Add Bed Modal ─────────────────────────────────────────────────────────────

function AddBedModal({ onClose, onAdd }) {
    const [bedId, setBedId] = useState('');
    const [bedType, setBedType] = useState('icu');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = bedId.trim().toUpperCase();
        if (!trimmed) { setError('Bed ID is required.'); return; }

        setLoading(true);
        try {
            const { error: insertError } = await supabase
                .from('beds')
                .insert([{
                    bed_number: trimmed,
                    bed_type: bedType,
                    status: 'available'
                }]);

            if (insertError) throw insertError;
            onAdd(); // Trigger refresh
            onClose();
        } catch (err) {
            console.error('Add bed error:', err);
            setError(err.message || 'Failed to add bed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#2b8cee]/5 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#2b8cee]/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#2b8cee] text-xl">bed</span>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Add New Bed</h2>
                            <p className="text-xs text-slate-500">Register a bed in the hospital system</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-slate-100 transition-colors">
                        <span className="material-symbols-outlined text-slate-500 text-xl">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                            Bed ID / Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={bedId}
                            onChange={(e) => { setBedId(e.target.value); setError(''); }}
                            placeholder="e.g. ICU-06, GEN-20"
                            disabled={loading}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/30 focus:border-[#2b8cee] transition-all"
                        />
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                            Bed Type <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setBedType('icu')}
                                disabled={loading}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${bedType === 'icu'
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 shadow-sm'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-2xl ${bedType === 'icu' ? 'text-red-500' : 'text-slate-400'}`}>monitor_heart</span>
                                <div className="text-center">
                                    <p className={`text-sm font-bold ${bedType === 'icu' ? 'text-red-700' : 'text-slate-700'}`}>ICU</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Intensive Care Unit</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setBedType('general')}
                                disabled={loading}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${bedType === 'general'
                                    ? 'border-[#2b8cee] bg-blue-50'
                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 shadow-sm'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-2xl ${bedType === 'general' ? 'text-[#2b8cee]' : 'text-slate-400'}`}>bed</span>
                                <div className="text-center">
                                    <p className={`text-sm font-bold ${bedType === 'general' ? 'text-blue-700' : 'text-slate-700'}`}>General Ward</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Standard ward bed</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >Cancel</button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-lg bg-[#2b8cee] hover:bg-blue-600 text-white text-sm font-bold shadow-md shadow-[#2b8cee]/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">add_circle</span>}
                            {loading ? 'Adding...' : 'Add Bed'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

const WARDS = ['All Wards', 'ICU', 'General Ward', 'Emergency', 'Pediatrics'];

export default function BedManagement() {
    const [activeWard, setActiveWard] = useState('All Wards');
    const [sortBy, setSortBy] = useState('Bed Number');
    const [beds, setBeds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddBed, setShowAddBed] = useState(false);

    const fetchBeds = useCallback(async () => {
        setLoading(true);
        try {
            // Join bed_queue to get patient info (OPD-admitted patients use text names, not patient_id)
            const { data, error } = await supabase
                .from('beds')
                .select(`
                    *,
                    queue_entry:bed_queue(patient_name, disease, admitted_from_opd_at, bed_assigned_at, status)
                `);

            if (error) throw error;

            // Pick the active queue entry for each bed (bed_assigned or admitted)
            const formatted = (data || []).map(bed => ({
                ...bed,
                activeQueue: bed.queue_entry?.find(
                    q => q.status === 'bed_assigned' || q.status === 'admitted'
                ) || bed.queue_entry?.[0] || null
            }));

            setBeds(formatted);
        } catch (err) {
            console.error('Fetch beds error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBeds();
    }, [fetchBeds]);

    const handleUpdateBedStatus = async (id, newStatus) => {
        try {
            const { error } = await supabase
                .from('beds')
                .update({ status: newStatus })
                .eq('bed_id', id);
            if (error) throw error;
            fetchBeds();
        } catch (err) {
            console.error('Update bed status error:', err);
        }
    };

    const handleDischarge = async (bedId) => {
        if (!window.confirm('Are you sure you want to discharge the patient and make this bed available?')) return;

        try {
            // 1. Mark the bed as available
            const { error: bedError } = await supabase
                .from('beds')
                .update({ status: 'available' })
                .eq('bed_id', bedId);

            if (bedError) throw bedError;

            // 2. Mark any active queue entries as discharged
            const { error: queueError } = await supabase
                .from('bed_queue')
                .update({
                    status: 'discharged',
                    discharged_at: new Date().toISOString()
                })
                .eq('bed_id', bedId)
                .in('status', ['admitted', 'bed_assigned']);

            if (queueError) throw queueError;

            fetchBeds();
        } catch (err) {
            console.error('Discharge error:', err);
            alert('Failed to discharge patient: ' + err.message);
        }
    };

    const filteredBeds = beds.filter(bed => {
        if (activeWard === 'All Wards') return true;
        if (activeWard === 'ICU') return bed.bed_type === 'icu';
        if (activeWard === 'General Ward') return bed.bed_type === 'general';
        return bed.bed_type?.toLowerCase() === activeWard.toLowerCase();
    });

    const sortedBeds = [...filteredBeds].sort((a, b) => {
        if (sortBy === 'Bed Number') return (a.bed_number || '').localeCompare(b.bed_number || '');
        if (sortBy === 'Acuity Level') {
            const priority = { critical: 0, occupied: 1, maintenance: 2, cleaning: 3, available: 4 };
            return priority[a.status] - priority[b.status];
        }
        return 0;
    });

    // Stats
    const stats = [
        { label: 'Occupied', count: beds.filter(b => b.status === 'occupied').length, color: 'bg-[#2b8cee]' },
        { label: 'Available', count: beds.filter(b => b.status === 'available').length, color: 'bg-green-500' },
        { label: 'Cleaning', count: beds.filter(b => b.status === 'cleaning').length, color: 'bg-yellow-500' },
        { label: 'Critical', count: beds.filter(b => b.status === 'critical').length, color: 'bg-red-500' },
    ];

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {showAddBed && <AddBedModal onClose={() => setShowAddBed(false)} onAdd={fetchBeds} />}

            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-md text-sm text-slate-600 font-medium">
                        <span className="material-symbols-outlined text-lg">domain</span>
                        <span>City General Hospital</span>
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                        <span className="text-[#2b8cee] font-semibold">Bed Management</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setShowAddBed(true)} className="flex items-center gap-2 rounded-lg h-10 px-4 bg-white hover:bg-slate-50 border border-slate-200 transition-colors text-slate-700 text-sm font-semibold">
                        <span className="material-symbols-outlined text-[20px] text-[#2b8cee]">add_box</span>
                        Add Bed
                    </button>
                    <button className="flex items-center gap-2 rounded-lg h-10 px-4 bg-[#2b8cee] hover:bg-blue-600 transition-colors text-white text-sm font-bold shadow-md shadow-[#2b8cee]/20">
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                        Quick Allocation
                    </button>
                    <div className="size-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined">person</span>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden bg-[#f6f7f8]">
                <main className="flex-1 flex flex-col min-w-0">
                    <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {WARDS.map((w) => (
                                <button
                                    key={w}
                                    onClick={() => setActiveWard(w)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeWard === w ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >{w}</button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span className="material-symbols-outlined text-lg">sort</span>
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                                className="bg-transparent border-none text-slate-900 font-semibold focus:ring-0 focus:outline-none p-0 cursor-pointer text-sm">
                                <option>Bed Number</option>
                                <option>Acuity Level</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {loading && beds.length === 0 ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-[#2b8cee] rounded-full"></div>
                            </div>
                        ) : sortedBeds.length === 0 ? (
                            <div className="py-20 text-center">
                                <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">bed</span>
                                <h3 className="text-lg font-bold text-slate-900">No beds found</h3>
                                <p className="text-slate-500 mt-1">Try changing filters or add a new bed.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {sortedBeds.map((bed) => (
                                    <BedCard key={bed.bed_id || bed.id} bed={bed} onUpdate={handleUpdateBedStatus} onDischarge={handleDischarge} />
                                ))}
                            </div>
                        )}
                    </div>
                </main>

                <aside className="w-64 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto hidden xl:flex">
                    <div className="p-5">
                        <div className="flex items-center gap-2 mb-6 text-[#2b8cee]">
                            <span className="material-symbols-outlined">analytics</span>
                            <h3 className="font-bold text-slate-900">Occupancy</h3>
                        </div>

                        <div className="space-y-4">
                            {stats.map((s) => (
                                <div key={s.label} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</span>
                                        <div className={`size-2 rounded-full ${s.color}`}></div>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold text-slate-900">{s.count}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">BEDS</span>
                                    </div>
                                    <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div className={`${s.color} h-full transition-all duration-500`} style={{ width: `${beds.length > 0 ? (s.count / beds.length) * 100 : 0}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-200">
                            <div className="bg-[#2b8cee] rounded-xl p-4 text-white shadow-lg shadow-[#2b8cee]/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-lg">bolt</span>
                                    <span className="text-xs font-bold uppercase tracking-wider opacity-80">AI Insight</span>
                                </div>
                                <h4 className="font-bold text-sm mb-1">ED Surge Predicted</h4>
                                <p className="text-[11px] opacity-90 leading-relaxed">
                                    Historical data suggests a 15% influx increase in the next 3 hours. Suggest clearing cleaning backlog.
                                </p>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
