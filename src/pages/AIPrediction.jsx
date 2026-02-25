import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { getActivePatients } from '../services/patientService';

// ── Queue Item ────────────────────────────────────────────────────────────────

function QueueItem({ item, onClick }) {
    const getTagColor = (status, queueType) => {
        if (queueType === 'icu') return 'bg-red-100 text-red-700';
        if (status === 'admitted') return 'bg-blue-100 text-blue-700';
        if (status === 'bed_assigned') return 'bg-green-100 text-green-700';
        return 'bg-yellow-100 text-yellow-800';
    };

    const getBarColor = (queueType, status) => {
        if (queueType === 'icu') return 'bg-red-500';
        if (status === 'admitted') return 'bg-blue-500';
        if (status === 'bed_assigned') return 'bg-green-500';
        return 'bg-yellow-400';
    };

    const getInitials = (name) => {
        if (!name) return 'P';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getStatusDisplay = (status, queueType, admittedDate) => {
        // Show Waiting if no admitted date (not yet admitted)
        if (!admittedDate) {
            return 'Waiting';
        }
        // Otherwise show actual status
        switch (status) {
            case 'admitted': return 'Admitted';
            case 'bed_assigned': return 'Bed Assigned';
            case 'waiting_for_bed': return 'Waiting';
            case 'assigned': return 'Assigned';
            case 'waiting': return 'Waiting';
            default: return status || 'Waiting';
        }
    };

    const admittedDate = item.admitted_date ? new Date(item.admitted_date).toLocaleDateString() : 'N/A';

    return (
        <div 
            onClick={onClick}
            className="group flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-[#2b8cee]/50 cursor-pointer transition-all hover:shadow-md relative overflow-hidden"
        >
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getBarColor(item.queue_type, item.status)}`} />
            <div className="w-11 h-11 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm">
                {getInitials(item.patient_name)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 truncate">
                        {item.patient_name} <span className="text-slate-400 font-normal text-sm ml-1">{item.display_token || item.id.slice(0, 8)}</span>
                    </h3>
                    <span className={`px-2 py-0.5 ${getTagColor(item.status, item.queue_type)} text-[10px] font-bold rounded uppercase`}>
                        {getStatusDisplay(item.status, item.queue_type, item.admitted_date)}
                    </span>
                </div>
                <p className="text-sm text-slate-500 truncate">
                    {item.display_disease} • {item.display_bed} • Admitted: {admittedDate}
                </p>
            </div>
            <div className="shrink-0">
                <button className="px-3 py-1.5 text-xs font-bold rounded transition-colors bg-[#2b8cee]/10 hover:bg-[#2b8cee]/20 text-[#2b8cee]">
                    Details
                </button>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AIPrediction() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const { data, error } = await getActivePatients();
            if (error) throw error;
            setPatients(data || []);
        } catch (err) {
            console.error('Error fetching patients:', err);
            setError('Failed to load patients. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const toggleStaff = (i) =>
        setStaff((prev) => prev.map((s, idx) => (idx === i ? { ...s, on: !s.on } : s)));

    const handlePatientClick = (patient) => {
        navigate(`/patients/${patient.id}?type=${patient.queue_type}`);
    };

    const filtered = patients.filter(
        (p) =>
            p.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
            p.display_token?.toLowerCase().includes(search.toLowerCase()) ||
            p.id.toLowerCase().includes(search.toLowerCase())
    );

    const icuPatients = filtered.filter((p) => p.queue_type === 'icu');
    const bedPatients = filtered.filter((p) => p.queue_type === 'bed');

    return (
        <div className="flex flex-1 overflow-hidden bg-[#f6f7f8]">

            {/* ── LEFT: Critical Alerts ── */}
            <aside className="w-[300px] xl:w-[340px] shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-y-auto hidden lg:flex">

                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-red-50/60">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-red-700 text-base font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px]">warning</span>
                            Critical Patient Alerts
                        </h2>
                        <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {icuPatients.length} ICU
                        </span>
                    </div>
                    <p className="text-xs text-red-600/80">Active ICU and high-priority patients requiring attention.</p>
                </div>

                <div className="flex-1 p-4 space-y-4">
                    {/* Show ICU patients as critical alerts */}
                    {icuPatients.slice(0, 3).map((patient) => (
                        <div key={patient.id} className="relative bg-white rounded-xl p-4 border border-red-200 shadow-sm hover:border-red-400 transition-colors cursor-pointer"
                            onClick={() => handlePatientClick(patient)}>
                            <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg">ICU</div>
                            <div className="flex gap-3 mb-3">
                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-red-500 shrink-0">
                                    <span className="material-symbols-outlined text-3xl">monitor_heart</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{patient.patient_name}</h3>
                                    <div className="text-red-600 text-sm font-bold uppercase tracking-tight">{patient.severity || 'Critical'}</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-3 px-1">
                                <span>Disease: <strong className="text-slate-900">{patient.display_disease}</strong></span>
                                <span>Bed: <strong className="text-slate-900">{patient.display_bed}</strong></span>
                            </div>
                            <button className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                                <span className="material-symbols-outlined text-lg">visibility</span> View Vitals
                            </button>
                        </div>
                    ))}

                    {icuPatients.length === 0 && (
                        <div className="text-center py-8 text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                            <p className="text-sm">No ICU patients currently</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* ── MIDDLE: Patient Queue ── */}
            <section className="flex-1 flex flex-col overflow-hidden bg-[#f6f7f8]">
                {/* Toolbar */}
                <div className="px-6 py-5 flex items-center justify-between shrink-0 flex-wrap gap-3 bg-white border-b border-slate-200 shadow-sm">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Patients Data</h1>
                        <p className="text-slate-500 text-sm">Active Patients • Real-time Status & Analytics</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex w-56 items-center bg-slate-50 rounded-lg border border-slate-200 px-3 h-10">
                            <span className="material-symbols-outlined text-slate-400 text-[20px]">search</span>
                            <input
                                className="bg-transparent border-none focus:ring-0 text-sm w-full text-slate-900 placeholder:text-slate-400 ml-2 focus:outline-none"
                                placeholder="Search patient name or ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={fetchPatients}
                            className="h-10 px-4 bg-[#2b8cee] text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">refresh</span> Refresh
                        </button>
                    </div>
                </div>

                {/* Queue list */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2 animate-spin">refresh</span>
                            <p className="text-sm">Loading patients...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-40 text-red-400">
                            <span className="material-symbols-outlined text-4xl mb-2">error</span>
                            <p className="text-sm">{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* ICU Patients */}
                            {icuPatients.length > 0 && (
                                <>
                                    <div className="flex items-center gap-4 py-1">
                                        <span className="text-xs font-bold text-red-600 uppercase tracking-widest whitespace-nowrap">ICU Patients</span>
                                        <div className="h-px bg-red-200 flex-1" />
                                    </div>
                                    {icuPatients.map((item) => <QueueItem key={item.id} item={item} onClick={() => handlePatientClick(item)} />)}
                                </>
                            )}

                            {/* Bed Queue Patients */}
                            {bedPatients.length > 0 && (
                                <>
                                    <div className={`flex items-center gap-4 py-1 ${icuPatients.length > 0 ? 'mt-4' : ''}`}>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">General Ward Patients</span>
                                        <div className="h-px bg-slate-200 flex-1" />
                                    </div>
                                    {bedPatients.map((item) => <QueueItem key={item.id} item={item} onClick={() => handlePatientClick(item)} />)}
                                </>
                            )}

                            {filtered.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                    <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                                    <p className="text-sm">No patients match your search</p>
                                </div>
                            )}

                            {patients.length === 0 && !search && (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                    <span className="material-symbols-outlined text-4xl mb-2">health_and_safety</span>
                                    <p className="text-sm">No active patients found</p>
                                    <p className="text-xs mt-1">All patients have been discharged</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* ── RIGHT: Bed Management ── */}
            <aside className="w-[300px] xl:w-[340px] shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-y-auto hidden lg:flex">

                {/* Header */}
                <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-slate-900">Bed Management</h2>
                        <button className="text-[#2b8cee] text-xs font-bold uppercase hover:underline">View Map</button>
                    </div>
                    <div className="flex gap-3">
                        {[
                            { label: 'Active', value: patients.length, color: 'text-slate-900' }, 
                            { label: 'ICU', value: icuPatients.length, color: 'text-red-500' }
                        ].map((s) => (
                            <div key={s.label} className="flex-1 bg-white p-3 rounded-lg border border-slate-200 text-center shadow-sm">
                                <span className={`block text-2xl font-black ${s.color}`}>{s.value}</span>
                                <span className="text-xs text-slate-500 font-bold uppercase">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 p-5 space-y-6">

                    {/* Patient Analytics Charts */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            Patient Analytics
                            <span className="h-px bg-slate-200 flex-1" />
                        </h3>
                        
                        {/* Chart 1: Patient Status Overview */}
                        <div className="bg-white border border-slate-200 p-4 rounded-xl mb-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Status Overview</h4>
                            <ResponsiveContainer width="100%" height={140}>
                                <BarChart
                                    data={[
                                        { name: 'Admitted', value: bedPatients.filter(p => p.status === 'admitted').length, color: '#3b82f6' },
                                        { name: 'ICU', value: icuPatients.length, color: '#ef4444' }
                                    ]}
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 11, fill: '#64748b' }} 
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                        <Cell fill="#3b82f6" />
                                        <Cell fill="#ef4444" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Chart 2: Ward Distribution */}
                        <div className="bg-white border border-slate-200 p-4 rounded-xl mb-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Ward Distribution</h4>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'General', value: bedPatients.filter(p => p.bed_type === 'general' || !p.bed_type).length, fill: '#3b82f6' },
                                            { name: 'Private', value: bedPatients.filter(p => p.bed_type === 'private').length, fill: '#10b981' },
                                            { name: 'ICU', value: icuPatients.length, fill: '#ef4444' },
                                            { name: 'Emergency', value: bedPatients.filter(p => p.bed_type === 'emergency').length, fill: '#f59e0b' }
                                        ].filter(d => d.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                    </Pie>
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36}
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '11px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Chart 3: Bed Type Breakdown */}
                        <div className="bg-white border border-slate-200 p-4 rounded-xl">
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Bed Type Distribution</h4>
                            <ResponsiveContainer width="100%" height={120}>
                                <BarChart
                                    layout="vertical"
                                    data={[
                                        { name: 'General', value: bedPatients.filter(p => p.bed_type === 'general').length },
                                        { name: 'Private', value: bedPatients.filter(p => p.bed_type === 'private').length },
                                        { name: 'ICU', value: icuPatients.length },
                                        { name: 'Maternity', value: bedPatients.filter(p => p.bed_type === 'maternity').length }
                                    ].filter(d => d.value > 0)}
                                    margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
                                >
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        axisLine={false} 
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#64748b' }}
                                        width={50}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                        {[
                                            { name: 'General', fill: '#3b82f6' },
                                            { name: 'Private', fill: '#10b981' },
                                            { name: 'ICU', fill: '#ef4444' },
                                            { name: 'Maternity', fill: '#ec4899' }
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}
