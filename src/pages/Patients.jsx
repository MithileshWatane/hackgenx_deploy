import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getPatientById, getPatientRounds, getLatestPrediction, getPatientJourney } from '../services/patientService';

// ── Keyframe style injected once ──────────────────────────────────────────────
const pulseStyle = `
@keyframes pulse-ring {
  0%   { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(43,140,238,0.6); }
  70%  { transform: scale(1);   box-shadow: 0 0 0 10px rgba(43,140,238,0); }
  100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(43,140,238,0); }
}
.pulse-active { animation: pulse-ring 2s infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1.5s linear infinite; }
`;

// ── Main Component ────────────────────────────────────────────────────────────

export default function Patients() {
    const { patientId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const queueType = searchParams.get('type') || 'bed';
    
    const [patient, setPatient] = useState(null);
    const [journey, setJourney] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (patientId) {
            fetchPatientData();
        } else {
            // No patient selected - could show a patient list or message
            setLoading(false);
        }
    }, [patientId, queueType]);

    const fetchPatientData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch patient details
            const { data: patientData, error: patientError } = await getPatientById(patientId, queueType);
            if (patientError) throw patientError;
            setPatient(patientData);

            // Fetch patient journey (appointment and opd data)
            const patientToken = patientData.token_number || patientData.patient_token;
            if (patientToken) {
                const { data: journeyData, error: journeyError } = await getPatientJourney(patientToken);
                if (!journeyError) {
                    setJourney(journeyData);
                }
            }

            // Fetch rounds
            const { data: roundsData, error: roundsError } = await getPatientRounds(patientId, queueType);
            if (roundsError) throw roundsError;
            setRounds(roundsData || []);

            // Fetch latest prediction
            const { data: predictionData, error: predictionError } = await getLatestPrediction(patientId, queueType);
            if (predictionError && predictionError.code !== 'PGRST116') throw predictionError;
            setPrediction(predictionData);

        } catch (err) {
            console.error('Error fetching patient data:', err);
            setError('Failed to load patient data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return 'P';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getJourneySteps = () => {
        if (!patient) return [];
        
        const isICU = patient.queue_type === 'icu';
        const isDischarged = patient.status === 'discharged';
        
        // Helper to format date/time
        const formatTime = (dateStr) => {
            if (!dateStr) return null;
            const date = new Date(dateStr);
            return date.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit'
            });
        };
        
        // Get journey data
        const appointmentDate = journey?.appointment?.appointment_date;
        const opdEnteredAt = journey?.opdQueue?.entered_queue_at;
        const opdCompletedAt = journey?.opdQueue?.completed_at;
        
        // Bed queue timestamps
        const bedQueueEnteredAt = patient.admitted_from_opd_at;
        const bedAssignedAt = patient.bed_assigned_at || patient.admitted_at;
        
        // ICU timestamps (if ICU patient)
        const icuQueueTime = patient.time;
        const icuAdmissionTime = patient.admission_time;
        
        // Discharge timestamp
        const dischargedAt = patient.discharged_at || patient.discharge_time;
        
        const steps = [];
        
        // 1. Appointment - always shown
        steps.push({
            icon: 'event',
            label: 'Appointment',
            time: formatTime(appointmentDate) || formatTime(patient.created_at) || 'Scheduled',
            done: true,
            active: false,
            hasRealDate: !!appointmentDate || !!patient.created_at
        });
        
        // 2. OPD Queue - always shown
        const opdDone = !!opdCompletedAt || !!bedQueueEnteredAt || !!icuQueueTime;
        steps.push({
            icon: 'stethoscope',
            label: 'OPD Queue',
            time: formatTime(opdEnteredAt) || formatTime(opdCompletedAt) || (opdDone ? 'Completed' : 'Pending'),
            done: opdDone,
            active: !!opdEnteredAt && !opdDone,
            hasRealDate: !!opdEnteredAt || !!opdCompletedAt || opdDone
        });
        
        // 3. Bed Queue - show actual time if patient came from ward, otherwise hide
        const inBedQueue = !!bedQueueEnteredAt;
        const bedQueueDone = !!bedAssignedAt;
        steps.push({
            icon: 'hotel',
            label: 'Bed Queue',
            time: inBedQueue 
                ? formatTime(bedQueueEnteredAt) 
                : (isICU && !bedQueueDone ? 'N/A' : 'Pending'),
            done: bedQueueDone,
            active: !isICU && inBedQueue && !bedAssignedAt,
            hasRealDate: inBedQueue || bedQueueDone
        });
        
        // 4. Ward Assignment - show actual time if patient was in ward before ICU
        const wardAssigned = !!bedAssignedAt;
        steps.push({
            icon: 'bed',
            label: 'Ward Assignment',
            time: wardAssigned 
                ? formatTime(bedAssignedAt) 
                : (isICU ? 'N/A' : 'Pending'),
            done: wardAssigned,
            active: !isICU && inBedQueue && !wardAssigned,
            hasRealDate: wardAssigned
        });
        
        // 5. ICU Queue - same for ICU and ward (shows N/A for ward)
        const inIcuQueue = !!icuQueueTime && !icuAdmissionTime;
        const icuQueueDone = !!icuAdmissionTime;
        steps.push({
            icon: 'local_hospital',
            label: 'ICU Queue',
            time: !isICU ? 'N/A' : (formatTime(icuQueueTime) || (inIcuQueue ? 'Waiting' : (icuQueueDone ? 'Admitted' : 'Pending'))),
            done: isICU && icuQueueDone,
            active: isICU && inIcuQueue,
            hasRealDate: isICU && !!icuQueueTime
        });
        
        // 6. ICU Assignment - same for ICU and ward (shows N/A for ward)
        const icuAdmitted = !!icuAdmissionTime;
        steps.push({
            icon: 'monitor_heart',
            label: 'ICU Assignment',
            time: !isICU ? 'N/A' : (formatTime(icuAdmissionTime) || (icuAdmitted ? 'Admitted' : 'Pending')),
            done: isICU && icuAdmitted,
            active: isICU && !isDischarged,
            hasRealDate: isICU && icuAdmitted
        });
        
        // 7. Discharge - always shown
        steps.push({
            icon: 'exit_to_app',
            label: 'Discharge',
            time: isDischarged 
                ? (formatTime(dischargedAt) || 'Completed')
                : (prediction?.predicted_discharge_date 
                    ? `Est: ${new Date(prediction.predicted_discharge_date).toLocaleDateString()}` 
                    : 'Pending'),
            done: isDischarged,
            active: false,
            hasRealDate: true // Always show discharge
        });
        
        return steps.filter(step => step.hasRealDate || step.label === 'Discharge');
    };

    // If no patient selected, show a message
    if (!patientId) {
        return (
            <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f8]">
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-slate-400">
                        <span className="material-symbols-outlined text-6xl mb-4">person_search</span>
                        <h2 className="text-xl font-semibold text-slate-600 mb-2">No Patient Selected</h2>
                        <p className="text-sm mb-4">Select a patient from the AI Prediction page to view details</p>
                        <button 
                            onClick={() => navigate('/ai-prediction')}
                            className="px-4 py-2 bg-[#2b8cee] text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                        >
                            Go to Patient Predictions
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f8]">
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-slate-400">
                        <span className="material-symbols-outlined text-6xl mb-4 animate-spin">refresh</span>
                        <h2 className="text-xl font-semibold text-slate-600">Loading patient data...</h2>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !patient) {
        return (
            <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f8]">
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-red-400">
                        <span className="material-symbols-outlined text-6xl mb-4">error</span>
                        <h2 className="text-xl font-semibold text-red-600 mb-2">{error || 'Patient not found'}</h2>
                        <button 
                            onClick={() => navigate('/ai-prediction')}
                            className="px-4 py-2 bg-[#2b8cee] text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                        >
                            Back to Patient Predictions
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const journeySteps = getJourneySteps();
    const patientName = patient.patient_name;
    const patientId_display = patient.token_number || patient.patient_token || patient.id.slice(0, 8);
    const patientAge = patient.age || 'N/A';
    const patientPhone = patient.phone || 'N/A';
    const ward = patient.queue_type === 'icu' ? 'ICU' : (patient.bed_type || 'General');
    const disease = patient.disease || patient.diseases || 'N/A';
    const admittedDate = patient.admitted_at || patient.bed_assigned_at || patient.admission_time || patient.admitted_from_opd_at;
    const totalDays = admittedDate ? Math.floor((new Date() - new Date(admittedDate)) / (1000 * 60 * 60 * 24)) : 0;

    return (
        <>
            <style>{pulseStyle}</style>

            <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f8]">

                {/* ── Page Header ── */}
                <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/ai-prediction')}
                            className="p-2 text-slate-400 hover:text-[#2b8cee] transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h1 className="text-xl font-bold text-slate-900">Patient Details</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center rounded-lg bg-slate-100 px-3 py-2 gap-2">
                            <span className="material-symbols-outlined text-slate-400 text-[20px]">badge</span>
                            <span className="text-sm font-medium text-slate-700">{patientId_display}</span>
                        </div>
                        <button className="relative p-2 text-slate-500 hover:text-[#2b8cee] transition-colors">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <div
                            className="size-9 rounded-full ring-2 ring-slate-100 bg-[#2b8cee] flex items-center justify-center text-white font-semibold"
                        >
                            {getInitials(patientName)}
                        </div>
                    </div>
                </header>

                {/* ── Scrollable Content ── */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-[1400px] mx-auto flex flex-col gap-6">

                        {/* ── Patient Header Card ── */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                            <div className="flex gap-5 items-center">
                                <div
                                    className="rounded-xl h-20 w-20 shadow-inner shrink-0 bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-400"
                                >
                                    {getInitials(patientName)}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{patientName}</h2>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-slate-500 text-sm">
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">badge</span> ID: {patientId_display}
                                        </span>
                                        <span className="size-1 bg-slate-300 rounded-full" />
                                        <span>Age: {patientAge} Yrs</span>
                                        <span className="size-1 bg-slate-300 rounded-full" />
                                        <span className="text-[#2b8cee] font-medium">Ward: {ward}</span>
                                        {patientPhone !== 'N/A' && (
                                            <>
                                                <span className="size-1 bg-slate-300 rounded-full" />
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[16px]">phone</span>
                                                    {patientPhone}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                                <button 
                                    onClick={fetchPatientData}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                                    Refresh
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2b8cee] text-white hover:bg-blue-600 font-medium text-sm shadow-sm shadow-blue-200 transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">call</span>
                                    Contact
                                </button>
                            </div>
                        </div>

                        {/* ── Main Grid ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left: Journey + Details */}
                            <div className="lg:col-span-2 flex flex-col gap-6">

                                {/* Journey Timeline */}
                                <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm border border-slate-200 relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
                                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[#2b8cee]">timeline</span>
                                            Patient Journey Status
                                        </h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                            patient.queue_type === 'icu' 
                                                ? 'bg-red-50 text-red-700' 
                                                : 'bg-blue-50 text-[#2b8cee]'
                                        }`}>
                                            {patient.queue_type === 'icu' ? 'ICU Patient' : `Status: ${patient.status?.replace(/_/g, ' ') || 'Active'}`}
                                        </span>
                                    </div>

                                    {/* Scrollable timeline */}
                                    <div className="overflow-x-auto pb-4 -mx-2 px-2">
                                        <div className="min-w-[700px] relative">

                                            {/* Track */}
                                            <div className="absolute top-[28px] left-0 w-full h-1 bg-slate-100 rounded-full" />
                                            {/* Progress */}
                                            <div className="absolute top-[28px] left-0 h-1 rounded-full overflow-hidden" style={{ width: `${(journeySteps.filter(s => s.done).length / journeySteps.length) * 100}%` }}>
                                                <div className="h-full bg-gradient-to-r from-blue-300 to-[#2b8cee] w-full rounded-full" />
                                            </div>

                                            <div className="grid relative z-10" style={{ gridTemplateColumns: `repeat(${journeySteps.length}, minmax(0, 1fr))` }}>
                                                {journeySteps.map((step) => {
                                                    if (step.done) return (
                                                        <div key={step.label} className="flex flex-col items-center gap-3 group">
                                                            <div className="size-14 rounded-full bg-[#2b8cee] text-white flex items-center justify-center shadow-md shadow-blue-200 border-4 border-white transition-transform group-hover:scale-110">
                                                                <span className="material-symbols-outlined">{step.icon}</span>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="font-bold text-slate-900 text-sm">{step.label}</p>
                                                                <p className="text-xs text-slate-500">{step.time}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                    if (step.active) return (
                                                        <div key={step.label} className="flex flex-col items-center gap-3">
                                                            <div className="size-14 rounded-full bg-white text-[#2b8cee] border-[3px] border-[#2b8cee] flex items-center justify-center relative z-20 pulse-active shadow-lg">
                                                                <span className="material-symbols-outlined spin">{step.icon}</span>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="font-bold text-[#2b8cee] text-sm">{step.label}</p>
                                                                <p className="text-xs text-[#2b8cee] font-medium">{step.time}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                    return (
                                                        <div key={step.label} className="flex flex-col items-center gap-3 opacity-40">
                                                            <div className="size-14 rounded-full bg-slate-100 text-slate-400 border-4 border-white flex items-center justify-center">
                                                                <span className="material-symbols-outlined">{step.icon}</span>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="font-medium text-slate-500 text-sm">{step.label}</p>
                                                                <p className="text-xs text-slate-400">{step.time}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Disease & Medical Info */}
                                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                                    <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#2b8cee]">medical_services</span>
                                        Medical Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex gap-4">
                                                <div className="flex-1 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Primary Condition</p>
                                                    <p className="text-base font-bold text-slate-900 mt-1">{disease}</p>
                                                </div>
                                                <div className="flex-1 p-3 bg-slate-50 rounded-lg">
                                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Days Admitted</p>
                                                    <p className="text-base font-bold text-slate-900 mt-1">{totalDays} days</p>
                                                </div>
                                            </div>
                                            
                                            {patient.queue_type === 'icu' && (
                                                <div className="flex gap-4">
                                                    <div className="flex-1 p-3 bg-red-50 rounded-lg border border-red-100">
                                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Severity</p>
                                                        <p className="text-base font-bold text-red-600 mt-1">{patient.severity || 'Critical'}</p>
                                                    </div>
                                                    <div className="flex-1 p-3 bg-slate-50 rounded-lg">
                                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Support Needed</p>
                                                        <p className="text-sm font-bold text-slate-900 mt-1">
                                                            {patient.ventilator_needed && 'Ventilator '}
                                                            {patient.dialysis_needed && 'Dialysis'}
                                                            {!patient.ventilator_needed && !patient.dialysis_needed && 'Standard Care'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-t md:border-t-0 md:border-l border-slate-200 md:pl-6 pt-4 md:pt-0">
                                            <p className="text-sm text-slate-500 mb-3">Recent Daily Rounds:</p>
                                            {rounds.length > 0 ? (
                                                <ul className="space-y-4 max-h-40 overflow-y-auto">
                                                    {rounds.slice(0, 3).map((round, idx) => (
                                                        <li key={round.id} className="flex gap-3 text-sm">
                                                            <div className="flex flex-col items-center">
                                                                <div className={`size-2 rounded-full mt-1.5 ${idx === 0 ? 'bg-[#2b8cee]' : 'bg-slate-300'}`} />
                                                                {idx < rounds.slice(0, 3).length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
                                                            </div>
                                                            <div className="pb-1">
                                                                <p className="text-slate-900 font-medium">{round.condition_status || 'Check-up'}</p>
                                                                <p className="text-slate-500 text-xs">{round.round_date} • BP: {round.blood_pressure || 'N/A'}</p>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">No rounds recorded yet</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right: AI Insights + Stats */}
                            <div className="flex flex-col gap-5">

                                {/* AI Insights */}
                                <div
                                    className="rounded-xl p-6 shadow-sm border border-[#2b8cee]/20 relative overflow-hidden"
                                    style={{ background: 'linear-gradient(135deg, rgba(43,140,238,0.05) 0%, #fff 100%)' }}
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                        <span className="material-symbols-outlined text-[120px] text-[#2b8cee]">psychology</span>
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-5">
                                            <span className="material-symbols-outlined text-[#2b8cee]">auto_awesome</span>
                                            <h3 className="font-bold text-slate-900">AI Discharge Prediction</h3>
                                        </div>

                                        {prediction ? (
                                            <>
                                                {/* Remaining days */}
                                                <div className="mb-5">
                                                    <p className="text-sm text-slate-500 mb-1">Estimated Remaining Stay</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-4xl font-bold text-slate-900">~{prediction.remaining_days || 'N/A'}</span>
                                                        <span className="text-lg font-medium text-slate-500">days</span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Predicted discharge: {prediction.predicted_discharge_date || 'N/A'}
                                                    </p>
                                                </div>

                                                {/* Confidence */}
                                                <div className="mb-5">
                                                    <p className="text-sm text-slate-500 mb-1">AI Confidence Score</p>
                                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                        <div 
                                                            className="bg-[#2b8cee] h-full rounded-full" 
                                                            style={{ width: `${(prediction.confidence || 0) * 100}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                        {Math.round((prediction.confidence || 0) * 100)}% Confidence
                                                    </p>
                                                </div>

                                                {/* Reasoning */}
                                                {prediction.reasoning && (
                                                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-slate-100">
                                                        <p className="text-xs text-slate-500 mb-1">AI Reasoning</p>
                                                        <p className="text-sm text-slate-700">{prediction.reasoning}</p>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center py-4 text-slate-400">
                                                <span className="material-symbols-outlined text-4xl mb-2">pending</span>
                                                <p className="text-sm">No prediction available yet</p>
                                                <p className="text-xs mt-1">Complete daily rounds to generate predictions</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Patient Stats */}
                                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Patient Stats</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center gap-1">
                                            <span className="material-symbols-outlined text-slate-400">timer</span>
                                            <span className="text-lg font-bold text-slate-900">{totalDays}d</span>
                                            <span className="text-xs text-slate-500">Total Stay</span>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center gap-1">
                                            <span className="material-symbols-outlined text-slate-400">medical_services</span>
                                            <span className="text-lg font-bold text-slate-900">{rounds.length}</span>
                                            <span className="text-xs text-slate-500">Rounds Done</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Quick Actions</h3>
                                    <div className="space-y-2">
                                        <button className="w-full py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#2b8cee] hover:border-[#2b8cee] text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-[18px]">add</span>
                                            Add Daily Round
                                        </button>
                                        <button className="w-full py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#2b8cee] hover:border-[#2b8cee] text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-[18px]">description</span>
                                            View Full History
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
