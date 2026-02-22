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

function StatusBadge({ status }) {
    const map = {
        waiting: 'bg-amber-100 text-amber-800',
        admitted: 'bg-green-100 text-green-800',
        cancelled: 'bg-slate-100 text-slate-600',
    };
    const label = {
        waiting: 'Waiting',
        admitted: 'Admitted',
        cancelled: 'Cancelled',
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] || 'bg-slate-100'}`}>
            {label[status] || status}
        </span>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ICUQueuePage() {
    const { user } = useAuth();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [updatingId, setUpdatingId] = useState(null);

    const fetchQueue = useCallback(async () => {
        if (!user?.id) { setLoading(false); return; }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('icu_queue')
                .select('*')
                .eq('status', 'waiting')
                .order('time', { ascending: true });

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

    const handleAction = async (id, newStatus) => {
        if (!window.confirm(`Are you sure you want to ${newStatus === 'admitted' ? 'admit' : 'cancel'} this request?`)) return;
        setUpdatingId(id);
        try {
            const { error } = await supabase
                .from('icu_queue')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            fetchQueue();
        } catch (err) {
            console.error('Update ICU queue error:', err);
            alert('Error: ' + err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const filtered = queue.filter(p =>
        p.patient_name.toLowerCase().includes(search.toLowerCase()) ||
        p.patient_token.toLowerCase().includes(search.toLowerCase()) ||
        p.diseases.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f8]">
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">ICU Admission Queue</h1>
                    <p className="text-xs text-slate-500">Critical care transfer requests</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center rounded-lg bg-slate-100 px-3 py-2">
                        <span className="material-symbols-outlined text-slate-400">search</span>
                        <input
                            className="ml-2 w-48 bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                            placeholder="Search patients..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={fetchQueue} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition-colors">
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-red-500 rounded-full"></div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-20 text-center">
                            <span className="material-symbols-outlined text-6xl text-slate-300 block mb-4">monitor_heart</span>
                            <p className="text-slate-500 text-lg font-medium">No pending ICU requests</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3 font-semibold">Token</th>
                                        <th className="px-5 py-3 font-semibold">Patient</th>
                                        <th className="px-5 py-3 font-semibold">Diagnosis/Surgery</th>
                                        <th className="px-5 py-3 font-semibold">Needs</th>
                                        <th className="px-5 py-3 font-semibold">Severity</th>
                                        <th className="px-5 py-3 font-semibold">Requested At</th>
                                        <th className="px-5 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <span className="font-mono text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                                                    {p.patient_token}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 font-semibold text-slate-900">{p.patient_name}</td>
                                            <td className="px-5 py-4">
                                                <p className="text-slate-900 font-medium">{p.diseases}</p>
                                                {p.surgery_type && <p className="text-[10px] text-slate-500 italic">{p.surgery_type}</p>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {p.ventilator_needed && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">Ventilator</span>}
                                                    {p.dialysis_needed && <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded font-bold">Dialysis</span>}
                                                    {p.is_emergency && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold">Emergency</span>}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {p.severity}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-500">{timeAgo(p.time)}</td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleAction(p.id, 'cancelled')} disabled={updatingId === p.id} className="p-1 text-slate-400 hover:text-slate-600">
                                                        <span className="material-symbols-outlined text-xl">block</span>
                                                    </button>
                                                    <button onClick={() => handleAction(p.id, 'admitted')} disabled={updatingId === p.id} className="flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 shadow-sm transition-all">
                                                        {updatingId === p.id ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                                                        Admit
                                                    </button>
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
