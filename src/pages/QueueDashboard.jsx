import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext_simple';
import { supabase } from '../lib/supabase';
import ShiftToICUModal from '../components/ShiftToICUModal';
import { autoAssignBed } from '../services/autoBedAssignmentService';

const MOVING_AVG_WINDOW = 5;
const DEFAULT_WAIT_MINUTES = 15;

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeMovingAvg(completedRows) {
    if (!completedRows || completedRows.length === 0) return DEFAULT_WAIT_MINUTES;
    const last5 = completedRows.slice(0, MOVING_AVG_WINDOW);
    const avg = last5.reduce((sum, r) => sum + parseFloat(r.actual_wait_minutes || 0), 0) / last5.length;
    return Math.round(avg);
}

function formatWait(mins) {
    if (!mins && mins !== 0) return '—';
    return `~${Math.round(mins)} min`;
}

function timeAgo(isoString) {
    if (!isoString) return '—';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    return `${diffMin} min ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const map = {
        waiting: 'bg-amber-100 text-amber-800',
        in_progress: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        cancelled: 'bg-slate-100 text-slate-600',
    };
    const label = {
        waiting: 'Waiting',
        in_progress: 'In Progress',
        completed: 'Completed',
        cancelled: 'Cancelled',
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}>
            {label[status] || status}
        </span>
    );
}

function AdmissionTypeModal({ patient, onClose, onSelect }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl">bed</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Admit Patient</h2>
                    <p className="text-sm text-slate-500 mb-6">Choose admission type for <strong>{patient.patient_name}</strong></p>

                    <div className="grid grid-cols-1 gap-3">
                        <button
                            onClick={() => onSelect('general')}
                            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-blue-600">ward</span>
                                <div className="text-left">
                                    <p className="font-bold text-slate-900">General Ward</p>
                                    <p className="text-xs text-slate-500">Standard admission</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-500 transition-colors">chevron_right</span>
                        </button>

                        <button
                            onClick={() => onSelect('icu')}
                            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-red-500 hover:bg-red-50 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-red-600">monitor_heart</span>
                                <div className="text-left">
                                    <p className="font-bold text-slate-900">ICU</p>
                                    <p className="text-xs text-slate-500">Critical care admission</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-300 group-hover:text-red-500 transition-colors">chevron_right</span>
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="mt-6 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, iconColor, iconBg, name, sub, count, avgWait, barPct, barColor }) {
    return (
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900">{name}</h3>
                    <p className="text-xs text-slate-500">{sub}</p>
                </div>
            </div>
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <span className="text-3xl font-bold text-slate-900">{count}</span>
                    <span className="ml-1 text-sm font-medium text-slate-500">Waiting</span>
                </div>
                <div className="text-right">
                    <span className="block text-sm font-medium text-slate-900">{avgWait}</span>
                    <span className="text-xs text-slate-500">Avg Wait (MA5)</span>
                </div>
            </div>
            <div>
                <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
                    <span>Capacity</span><span>{barPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${barPct}%` }} />
                </div>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function QueueDashboard() {
    const { user } = useAuth();
    const [queue, setQueue] = useState([]);
    const [completedPatients, setCompletedPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markingId, setMarkingId] = useState(null);
    const [admittingId, setAdmittingId] = useState(null);
    const [search, setSearch] = useState('');
    const [movingAvgWait, setMovingAvgWait] = useState(DEFAULT_WAIT_MINUTES);
    const [showAdmitTypeModal, setShowAdmitTypeModal] = useState(false);
    const [selectedPatientForAdmit, setSelectedPatientForAdmit] = useState(null);
    const [showICUModal, setShowICUModal] = useState(false);

    const fetchQueue = useCallback(async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Fetch active queue (waiting + in_progress)
            const { data: activeData } = await supabase
                .from('opd_queue')
                .select('*')
                .eq('doctor_id', user.id)
                .in('status', ['waiting', 'in_progress'])
                .order('queue_position', { ascending: true });

            // Fetch last 5 completed for moving average
            const { data: completedData } = await supabase
                .from('opd_queue')
                .select('actual_wait_minutes, completed_at, patient_name')
                .eq('doctor_id', user.id)
                .eq('status', 'completed')
                .not('actual_wait_minutes', 'is', null)
                .order('completed_at', { ascending: false })
                .limit(MOVING_AVG_WINDOW);

            setQueue(activeData || []);
            setCompletedPatients(completedData || []);
            setMovingAvgWait(computeMovingAvg(completedData));
        } catch (err) {
            console.error('Queue fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchQueue();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchQueue, 30000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    const handleMarkComplete = async (queueEntry) => {
        if (!window.confirm(`Mark ${queueEntry.patient_name} as consultation complete?`)) return;

        setMarkingId(queueEntry.id);
        try {
            const completedAt = new Date().toISOString();
            const enteredAt = new Date(queueEntry.entered_queue_at).getTime();
            const actualWaitMinutes = parseFloat(
                ((Date.now() - enteredAt) / 60000).toFixed(2)
            );

            // Update opd_queue row
            const { error: qError } = await supabase
                .from('opd_queue')
                .update({
                    status: 'completed',
                    completed_at: completedAt,
                    actual_wait_minutes: actualWaitMinutes,
                    consultation_started_at: queueEntry.consultation_started_at || completedAt,
                })
                .eq('id', queueEntry.id);

            if (qError) throw qError;

            // Update the appointment status to completed
            if (queueEntry.appointment_id) {
                await supabase
                    .from('appointments')
                    .update({ status: 'completed' })
                    .eq('id', queueEntry.appointment_id);
            }

            await fetchQueue();
        } catch (err) {
            console.error('Mark complete error:', err);
            alert('Failed to mark as complete: ' + err.message);
        } finally {
            setMarkingId(null);
        }
    };

    const handleAdmit = (queueEntry) => {
        setSelectedPatientForAdmit(queueEntry);
        setShowAdmitTypeModal(true);
    };

    const confirmAdmission = async (type) => {
        if (!selectedPatientForAdmit) return;

        if (type === 'icu') {
            setShowAdmitTypeModal(false);
            setShowICUModal(true);
            return;
        }

        // General Ward Admission Logic
        const queueEntry = selectedPatientForAdmit;
        setShowAdmitTypeModal(false);
        setAdmittingId(queueEntry.id);
        try {
            // 1. Insert into bed_queue
            const { data: insertedQueue, error: bqError } = await supabase
                .from('bed_queue')
                .insert([{
                    opd_queue_id: queueEntry.id,
                    appointment_id: queueEntry.appointment_id,
                    patient_name: queueEntry.patient_name,
                    disease: queueEntry.disease,
                    token_number: queueEntry.token_number,
                    doctor_id: queueEntry.doctor_id,
                    bed_type: 'general',
                    status: 'waiting_for_bed',
                    admitted_from_opd_at: new Date().toISOString(),
                }])
                .select();

            if (bqError) throw bqError;

            // 2. Auto-assign bed if available
            let assignmentResult = null;
            if (insertedQueue && insertedQueue[0]) {
                assignmentResult = await autoAssignBed(
                    insertedQueue[0].id,
                    queueEntry.patient_name,
                    'general'
                );
            }

            // 3. Mark the OPD queue entry as completed
            const completedAt = new Date().toISOString();
            const actualWaitMinutes = parseFloat(
                ((Date.now() - new Date(queueEntry.entered_queue_at).getTime()) / 60000).toFixed(2)
            );
            await supabase
                .from('opd_queue')
                .update({
                    status: 'completed',
                    completed_at: completedAt,
                    actual_wait_minutes: actualWaitMinutes,
                    consultation_started_at: queueEntry.consultation_started_at || completedAt,
                })
                .eq('id', queueEntry.id);

            await fetchQueue();
            
            // Show appropriate message based on assignment result
            if (assignmentResult?.bedAssigned) {
                alert(`✅ ${queueEntry.patient_name} admitted and assigned to Bed ${assignmentResult.bed.bed_number}!`);
            } else if (assignmentResult?.waitTimeMinutes) {
                alert(`📋 ${queueEntry.patient_name} added to bed queue.\nEstimated wait time: ${Math.ceil(assignmentResult.waitTimeMinutes / 60)}h ${assignmentResult.waitTimeMinutes % 60}m`);
            } else {
                alert(`${queueEntry.patient_name} added to General Ward queue.`);
            }
        } catch (err) {
            console.error('Admit error:', err);
            alert('Failed to admit: ' + err.message);
        } finally {
            setAdmittingId(null);
            setSelectedPatientForAdmit(null);
        }
    };

    const handleICUShiftComplete = async () => {
        if (!selectedPatientForAdmit) return;
        const queueEntry = selectedPatientForAdmit;

        try {
            // Mark OPD entry as complete
            const completedAt = new Date().toISOString();
            const actualWaitMinutes = parseFloat(
                ((Date.now() - new Date(queueEntry.entered_queue_at).getTime()) / 60000).toFixed(2)
            );
            await supabase
                .from('opd_queue')
                .update({
                    status: 'completed',
                    completed_at: completedAt,
                    actual_wait_minutes: actualWaitMinutes,
                    consultation_started_at: queueEntry.consultation_started_at || completedAt,
                })
                .eq('id', queueEntry.id);

            await fetchQueue();
            alert(`${queueEntry.patient_name} added to ICU Queue.`);
        } catch (err) {
            console.error('ICU admission completion error:', err);
        } finally {
            setShowICUModal(false);
            setSelectedPatientForAdmit(null);
        }
    };

    const filtered = queue.filter(
        (p) =>
            p.patient_name.toLowerCase().includes(search.toLowerCase()) ||
            (p.token_number || '').toLowerCase().includes(search.toLowerCase())
    );

    const waitingCount = queue.filter(p => p.status === 'waiting').length;
    const inProgressCount = queue.filter(p => p.status === 'in_progress').length;
    const capacityPct = Math.min(Math.round((queue.length / 20) * 100), 100);

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f8]">
            {showAdmitTypeModal && selectedPatientForAdmit && (
                <AdmissionTypeModal
                    patient={selectedPatientForAdmit}
                    onClose={() => setShowAdmitTypeModal(false)}
                    onSelect={confirmAdmission}
                />
            )}

            {showICUModal && selectedPatientForAdmit && (
                <ShiftToICUModal
                    patient={selectedPatientForAdmit}
                    onClose={() => setShowICUModal(false)}
                    onShift={handleICUShiftComplete}
                />
            )}

            {/* Header */}
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">OPD Queue — Real-Time</h1>
                    {!loading && (
                        <p className="text-xs text-slate-500">
                            Moving Avg Wait (last {MOVING_AVG_WINDOW}): <span className="font-semibold text-[#2b8cee]">~{movingAvgWait} min</span>
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center rounded-lg bg-slate-100 px-3 py-2">
                        <span className="material-symbols-outlined text-slate-400">search</span>
                        <input
                            className="ml-2 w-52 bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                            placeholder="Search patient or token..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={fetchQueue}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#2b8cee] transition-colors"
                        title="Refresh queue"
                    >
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">

                {/* Stat Cards */}
                <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                    <StatCard
                        icon="local_hospital"
                        iconColor="text-blue-600"
                        iconBg="bg-blue-100"
                        name="OPD Queue"
                        sub="General Medicine"
                        count={waitingCount}
                        avgWait={`~${movingAvgWait} min`}
                        barColor="bg-[#2b8cee]"
                        barPct={capacityPct}
                    />

                    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                                <span className="material-symbols-outlined">auto_awesome</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">Moving Average</h3>
                                <p className="text-xs text-slate-500">Last {completedPatients.length}/{MOVING_AVG_WINDOW} completed</p>
                            </div>
                        </div>
                        <div className="mt-auto">
                            <span className="text-3xl font-bold text-[#2b8cee]">~{movingAvgWait}</span>
                            <span className="ml-1 text-sm font-medium text-slate-500">min/patient</span>
                        </div>
                        {completedPatients.length > 0 && (
                            <div className="mt-3 space-y-1">
                                {completedPatients.slice(0, 3).map((p, i) => (
                                    <div key={i} className="flex justify-between text-xs text-slate-500">
                                        <span className="truncate max-w-[100px]">{p.patient_name}</span>
                                        <span className="font-medium">{Math.round(p.actual_wait_minutes)} min</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Queue Table */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Live OPD Patient Queue</h2>
                            <p className="text-sm text-slate-500">
                                Wait times estimated via {MOVING_AVG_WINDOW}-patient moving average &nbsp;
                                <span className="material-symbols-outlined text-[14px] text-[#2b8cee] align-middle">auto_awesome</span>
                            </p>
                        </div>
                        <span className="rounded-full bg-[#2b8cee]/10 px-3 py-1 text-xs font-semibold text-[#2b8cee]">
                            {queue.length} in queue
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-[#2b8cee] rounded-full"></div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16">
                            <span className="material-symbols-outlined text-6xl text-slate-300 block mb-3">queue</span>
                            <p className="text-slate-500 text-lg font-medium">No patients in queue</p>
                            <p className="text-slate-400 text-sm mt-1">
                                {search ? 'Try a different search term' : 'Book an appointment to add patients to the OPD queue'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3 font-semibold">Pos.</th>
                                        <th className="px-5 py-3 font-semibold">Token</th>
                                        <th className="px-5 py-3 font-semibold">Patient</th>
                                        <th className="px-5 py-3 font-semibold">Disease</th>
                                        <th className="px-5 py-3 font-semibold">Waiting Since</th>
                                        <th className="px-5 py-3 font-semibold">
                                            <div className="flex items-center gap-1">
                                                Est. Wait <span className="material-symbols-outlined text-[14px] text-[#2b8cee]">auto_awesome</span>
                                            </div>
                                        </th>
                                        <th className="px-5 py-3 font-semibold">Status</th>
                                        <th className="px-5 py-3 font-semibold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((p) => (
                                        <tr
                                            key={p.id}
                                            className={
                                                p.status === 'in_progress'
                                                    ? 'bg-blue-50/60 hover:bg-blue-50'
                                                    : 'hover:bg-slate-50 transition-colors'
                                            }
                                        >
                                            <td className="px-5 py-4">
                                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                                                    {p.queue_position}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="font-mono text-xs font-bold text-[#2b8cee] bg-blue-50 px-2 py-1 rounded">
                                                    {p.token_number || '—'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 font-semibold text-slate-900">{p.patient_name}</td>
                                            <td className="px-5 py-4 text-slate-600">{p.disease}</td>
                                            <td className="px-5 py-4 text-slate-500 text-xs">{timeAgo(p.entered_queue_at)}</td>
                                            <td className="px-5 py-4">
                                                <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded text-xs">
                                                    {formatWait(p.estimated_wait_minutes)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Admit to Bed */}
                                                    <button
                                                        onClick={() => handleAdmit(p)}
                                                        disabled={admittingId === p.id || markingId === p.id}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                    >
                                                        {admittingId === p.id ? (
                                                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[16px]">bed</span>
                                                        )}
                                                        {admittingId === p.id ? 'Admitting...' : 'Admit'}
                                                    </button>
                                                    {/* Mark Complete */}
                                                    <button
                                                        onClick={() => handleMarkComplete(p)}
                                                        disabled={markingId === p.id || admittingId === p.id}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                    >
                                                        {markingId === p.id ? (
                                                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                                        )}
                                                        {markingId === p.id ? 'Saving...' : 'Complete'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer */}
                    {!loading && filtered.length > 0 && (
                        <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
                            Showing {filtered.length} patient{filtered.length !== 1 ? 's' : ''} in active queue
                        </div>
                    )}
                </div>

                {/* Recently Completed */}
                {completedPatients.length > 0 && (
                    <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm p-5">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-green-600">history</span>
                            Recent Completions (used in moving average)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {completedPatients.map((p, i) => (
                                <div key={i} className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                                    <p className="text-xs text-green-600 font-medium truncate">{p.patient_name}</p>
                                    <p className="text-xl font-bold text-green-800 mt-1">{Math.round(p.actual_wait_minutes)}<span className="text-xs font-normal"> min</span></p>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-3">
                            Moving average of these {completedPatients.length} patient{completedPatients.length !== 1 ? 's' : ''} = <strong className="text-slate-600">~{movingAvgWait} min</strong>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
