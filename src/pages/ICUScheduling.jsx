import React, { useState, useEffect } from "react";
import {
  runOptimizedSchedule,
  predictWaitTime,
} from "../services/schedulingService";
import {
  getICUBeds,
  addICUBed,
  updateICUBed,
  deleteICUBed,
} from "../services/bedService";
import { supabase } from "../lib/supabase";
import DailyRoundModal from "../components/DailyRoundModal";
import { autoAssignICUBed } from "./ICUQueuePage";
import { useAuth } from '../context/AuthContext_simple';

export default function ICUScheduling() {
  const { user } = useAuth();
  const [loadingType, setLoadingType] = useState(null); // "optimized" | "prediction" | null
  const [error, setError] = useState("");
  const [roundBed, setRoundBed] = useState(null); // bed selected for daily round
  const [qrBed, setQrBed] = useState(null); // bed selected for QR
  const [optimizedResult, setOptimizedResult] = useState(null);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [waitPredictions, setWaitPredictions] = useState({});

  const [beds, setBeds] = useState([]);
  const [bedStats, setBedStats] = useState(null);
  const [showAddBedForm, setShowAddBedForm] = useState(false);
  const [editingBed, setEditingBed] = useState(null);
  const [bedFormLoading, setBedFormLoading] = useState(false);
  const [showcaseBedFeatures, setShowcaseBedFeatures] = useState({
    multiparameterMonitor: false,
    oxygenSupplySystem: false,
  });
  const [bedForm, setBedForm] = useState({
    bed_id: "",
    bed_type: "Basic",
    ventilator_available: false,
    dialysis_available: false,
    is_available: true,
  });
  const [schedulingPolicyText, setSchedulingPolicyText] = useState(() => {
    try {
      return localStorage.getItem("icu-scheduling-policy-feedback") || "";
    } catch {
      return "";
    }
  });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const handleRunOptimized = async () => {
    setLoadingType("optimized");
    setError("");
    try {
      const res = await runOptimizedSchedule();
      setOptimizedResult(res.data || res);
    } catch (err) {
      console.error("Optimized schedule error:", err);
      setError(err.message || "Failed to run optimized scheduler");
    } finally {
      setLoadingType(null);
    }
  };

  // Load waiting ICU queue patients for current doctor only
  const loadWaitingQueue = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('icu_queue')
        .select('*')
        .eq('doctor_id', user.id)
        .eq('status', 'waiting')
        .order('time', { ascending: true });

      if (error) throw error;
      setWaitingQueue(data || []);
    } catch (err) {
      console.error("Error loading waiting queue:", err);
    }
  };

  // Get wait time prediction for a patient
  const getWaitTimePrediction = async (patientToken) => {
    setLoadingType("prediction");
    try {
      const result = await predictWaitTime(patientToken, 20);
      setWaitPredictions(prev => ({
        ...prev,
        [patientToken]: result.data
      }));
    } catch (err) {
      console.error("Prediction error:", err);
      setError(err.message || "Failed to get wait time prediction");
    } finally {
      setLoadingType(null);
    }
  };

  // Load predictions for all waiting patients
  const loadAllPredictions = async () => {
    if (waitingQueue.length === 0) return;
    
    setLoadingType("prediction");
    setError("");
    try {
      const predictions = {};
      for (const patient of waitingQueue) {
        try {
          const result = await predictWaitTime(patient.patient_token, 20);
          predictions[patient.patient_token] = result.data;
        } catch (err) {
          console.error(`Prediction failed for ${patient.patient_token}:`, err);
        }
      }
      setWaitPredictions(predictions);
    } catch (err) {
      console.error("Error loading predictions:", err);
    } finally {
      setLoadingType(null);
    }
  };

  // Load beds data for current doctor only
  const loadBedsData = async () => {
    if (!user?.id) return;
    try {
      const [bedsData, { data: queueData, error: queueError }] = await Promise.all([
        getICUBeds(user.id),  // Pass doctor ID
        supabase.from('icu_queue').select('*').eq('doctor_id', user.id).in('status', ['assigned'])
      ]);

      if (queueError) throw queueError;

      // Map queue data to beds — compare as strings to handle UUID vs integer mismatches
      const formattedBeds = bedsData.map(bed => ({
        ...bed,
        is_icu: true,
        activeQueue: queueData.find(q =>
          String(q.assigned_bed_id) === String(bed.id) ||
          String(q.assigned_bed_label).toUpperCase() === String(bed.bed_id).toUpperCase()
        ) || null
      }));

      setBeds(formattedBeds);

      // Calculate stats locally
      const stats = {
        total: formattedBeds.length,
        available: formattedBeds.filter(b => b.is_available).length,
        occupied: formattedBeds.filter(b => !b.is_available).length,
        withVentilator: formattedBeds.filter(b => b.ventilator_available).length,
        withDialysis: formattedBeds.filter(b => b.dialysis_available).length,
      };
      setBedStats(stats);
    } catch (err) {
      console.error("Error loading beds:", err);
      setError("Failed to load ICU bed data");
    }
  };

  // Load beds on component mount
  useEffect(() => {
    loadBedsData();
    loadWaitingQueue();
  }, []);

  // Bed management functions
  const handleAddBed = async () => {
    setBedFormLoading(true);
    try {
      await addICUBed(bedForm, user.id);
      setBedForm({
        bed_id: "",
        bed_type: "Basic",
        ventilator_available: false,
        dialysis_available: false,
        is_available: true,
      });
      setShowAddBedForm(false);
      await loadBedsData();

      // After adding a new available bed, try to auto-assign to waiting patient
      const result = await autoAssignICUBed(user.id);
      if (result.assigned > 0) {
        await loadBedsData(); // Reload to show updated bed assignment
        alert(`✅ ${result.message}`);
      }
    } catch (err) {
      setError(err.message || "Failed to add bed");
    } finally {
      setBedFormLoading(false);
    }
  };

  const handleUpdateBed = async () => {
    if (!editingBed) return;
    setBedFormLoading(true);
    try {
      await updateICUBed(editingBed.id, bedForm);
      setEditingBed(null);
      setBedForm({
        bed_id: "",
        bed_type: "Basic",
        ventilator_available: false,
        dialysis_available: false,
        is_available: true,
      });
      await loadBedsData();
    } catch (err) {
      setError(err.message || "Failed to update bed");
    } finally {
      setBedFormLoading(false);
    }
  };

  const handleDeleteBed = async (id) => {
    if (!confirm("Are you sure you want to delete this bed?")) return;
    try {
      await deleteICUBed(id);
      await loadBedsData();
    } catch (err) {
      setError(err.message || "Failed to delete bed");
    }
  };

  const startEditBed = (bed) => {
    setEditingBed(bed);
    setBedForm({
      bed_id: bed.bed_id,
      bed_type: bed.bed_type,
      ventilator_available: bed.ventilator_available,
      dialysis_available: bed.dialysis_available,
      is_available: bed.is_available,
    });
    setShowAddBedForm(true);
  };

  const handleDischarge = async (bed) => {
    const patient = bed.activeQueue;
    if (!patient) return;
    
    if (!window.confirm(`Discharge ${patient.patient_name} from ICU Bed ${bed.bed_id}?`)) return;
    
    try {
      // 1. Free up ICU bed
      const { error: bedError } = await supabase
        .from('icu_beds')
        .update({ is_available: true })
        .eq('id', bed.id);

      if (bedError) throw bedError;

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
        await loadBedsData();
        alert(`✅ ${patient.patient_name} discharged. ${result.message}`);
      } else {
        await loadBedsData();
        alert(`✅ ${patient.patient_name} has been discharged.`);
      }
    } catch (err) {
      console.error('Discharge error:', err);
      alert('Error: ' + err.message);
    }
  };

  const cancelBedForm = () => {
    setEditingBed(null);
    setBedForm({
      bed_id: "",
      bed_type: "Basic",
      ventilator_available: false,
      dialysis_available: false,
      is_available: true,
    });
    setShowcaseBedFeatures({
      multiparameterMonitor: false,
      oxygenSupplySystem: false,
    });
    setShowAddBedForm(false);
  };

  const renderStatsCard = (title, result, accentColor) => {
    if (!result) return null;

    const {
      totalWaitingHours,
      averageWaitingHours,
      admittedPatients,
      optimizationRuns,
    } = result;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-xl"
              style={{ color: accentColor }}
            >
              monitor_heart
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {title}
            </h3>
          </div>
          {optimizationRuns != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              <span className="material-symbols-outlined text-[14px]">
                bolt
              </span>
              {optimizationRuns} runs
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-1">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Total Waiting
            </p>
            <p className="text-base font-bold text-slate-900">
              {totalWaitingHours ?? "—"}
              <span className="ml-1 text-[11px] font-medium text-slate-500">
                hrs
              </span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Avg Waiting
            </p>
            <p className="text-base font-bold text-slate-900">
              {averageWaitingHours != null
                ? averageWaitingHours.toFixed(1)
                : "—"}
              <span className="ml-1 text-[11px] font-medium text-slate-500">
                hrs
              </span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Assigned
            </p>
            <p className="text-base font-bold text-slate-900">
              {admittedPatients ?? "—"}
              <span className="ml-1 text-[11px] font-medium text-slate-500">
                patients
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  };

  const ICUBedCard = ({ bed, onEdit, onDelete, onRound, onDischarge, onShowQr }) => {
    const q = bed.activeQueue;
    const isAvailable = bed.is_available;

    const fmt = (iso) => {
      if (!iso) return null;
      const d = new Date(iso);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
    };

    const countdown = (dischargeIso) => {
      if (!dischargeIso) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const targetDate = new Date(dischargeIso);
      targetDate.setHours(0, 0, 0, 0);

      const diffMs = targetDate.getTime() - today.getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (days < 0) return { label: 'Overdue', color: 'text-red-500' };
      if (days === 0) return { label: 'DC Today', color: 'text-amber-500 font-bold' };

      return {
        label: `${days}d left`,
        color: days <= 1 ? 'text-amber-500' : 'text-emerald-600'
      };
    };

    const admitDate = fmt(q?.admission_time || q?.time);
    const dischargeDate = fmt(q?.discharge_time);
    const ct = countdown(q?.discharge_time);

    if (isAvailable) {
      return (
        <div className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-green-500/50 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full">
          <div className="h-1 bg-green-500 w-full absolute top-0" />
          <div className="p-5 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start">
              <span className="font-bold text-slate-900 text-xl">{bed.bed_id}</span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Available</span>
            </div>
            <div className="flex-1 flex flex-col gap-2 my-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Type: {bed.bed_type}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {bed.ventilator_available && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">VENT</span>}
                {bed.dialysis_available && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-bold">DIAL</span>}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button onClick={() => onEdit(bed)} className="flex-1 py-1.5 rounded text-[11px] font-bold uppercase text-blue-600 border border-blue-100 hover:bg-blue-50 transition-colors">Edit</button>
              <button onClick={() => onDelete(bed.id)} className="flex-1 py-1.5 rounded text-[11px] font-bold uppercase text-red-600 border border-red-100 hover:bg-red-50 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      );
    }

    // Occupied ICU Card
    return (
      <div className="group bg-white rounded-xl border border-red-200 shadow-sm hover:shadow-md hover:border-red-400 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full ring-2 ring-red-50">
        <div className="h-1 bg-red-500 w-full absolute top-0" />
        <div className="p-5 flex flex-col h-full">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-slate-900 text-xl">{bed.bed_id}</span>
            <div className="flex flex-col items-end gap-1">
              <div className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">monitor_heart</span>
                Occupied (ICU)
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShowQr?.(bed); }}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 bg-white"
              >
                <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                QR
              </button>
            </div>
          </div>
          <h4 className="text-base font-semibold text-slate-900 truncate">{q?.patient_name || '—'}</h4>
          <p className="text-xs text-slate-500 font-medium truncate mb-2">{q?.diseases || 'General ICU Care'}</p>

          <div className="mt-2 mb-1 grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-slate-50 rounded-lg p-1.5">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Assigned On</p>
              <p className="text-[11px] font-bold text-slate-700">{admitDate || '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Est. DC</p>
              <p className="text-[11px] font-bold text-slate-700">{dischargeDate || '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Remaining</p>
              <p className={`text-[11px] font-bold ${ct?.color || 'text-slate-400'}`}>{ct?.label || '—'}</p>
            </div>
          </div>

          <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <span className="material-symbols-outlined text-sm">monitor_heart</span>
              <span className="uppercase tracking-wider">ICU</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onDischarge(bed); }}
                className="text-[10px] font-bold uppercase tracking-wider bg-slate-600 text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors border border-slate-500 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">logout</span>
                Discharge
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRound(bed); }}
                className="text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors border border-red-100 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">edit_note</span>
                Round
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-md text-sm text-slate-600 font-medium">
            <span className="material-symbols-outlined text-lg">
              domain
            </span>
            <span>City General Hospital</span>
            <span className="material-symbols-outlined text-lg">
              chevron_right
            </span>
            <span className="text-[#2b8cee] font-semibold">
              ICU Scheduling
            </span>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <span className="material-symbols-outlined text-[#2b8cee]">
              schedule
            </span>
            <span className="text-sm font-semibold text-slate-900">
              ICU Scheduling
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Scheduling Actions */}
          <>
            {/* <button
              onClick={handleRunOptimized}
              disabled={loadingType === "optimized"}
              className="flex items-center gap-2 rounded-lg h-10 px-4 bg-[#2b8cee] hover:bg-blue-600 transition-colors text-white text-sm font-bold shadow-md shadow-[#2b8cee]/20 disabled:opacity-60"
            >
              {loadingType === "optimized" ? (
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">
                  bolt
                </span>
              )}
              Optimized Run
            </button> */}
          </>

          {/* Bed Management Actions */}
          <button
            onClick={() => setShowAddBedForm(true)}
            className="flex items-center gap-2 rounded-lg h-10 px-4 bg-green-600 hover:bg-green-700 transition-colors text-white text-sm font-bold shadow-md shadow-green-600/20"
          >
            <span className="material-symbols-outlined text-[20px]">
              add
            </span>
            Add Bed
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-[#f6f7f8] p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] mt-[1px]">
              error
            </span>
            <span>{error}</span>
          </div>
        )}

        {/* Scheduling Content */}
        <>
          <div className="grid grid-cols-1 gap-6 mb-6">
            {renderStatsCard(
              "Optimized Schedule",
              optimizedResult,
              "#2b8cee"
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-1 uppercase tracking-wide">
                How this works
              </h3>
              <p className="text-sm text-slate-600 mb-3">
                The ICU scheduling engine reads live patient and bed data from the
                hospital database (via Supabase), generates admissions into the
                ICU, and writes the resulting plan back to the{" "}
                <span className="font-semibold">admissions</span> table.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                <li>
                  <span className="font-semibold">Optimized</span> runs multiple
                  randomized priority orders and keeps the plan with the lowest
                  total waiting time.
                </li>
                <li>
                  The endpoint clears old ICU admissions and then inserts the new
                  optimized plan.
                </li>
              </ul>
            </div>

            <div className="bg-[#2b8cee] rounded-2xl shadow-lg shadow-[#2b8cee]/30 p-5 text-white flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">
                  insights
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                    Decision Support
                  </p>
                  <p className="text-sm font-bold">Triage ICU beds smarter</p>
                </div>
              </div>
              <p className="text-[13px] leading-relaxed opacity-90">
                Use this panel before rounds or during surge situations to
                understand how many patients can realistically be admitted to ICU
                and what the expected waiting burden will be across different
                strategies.
              </p>
              <p className="text-[11px] leading-relaxed opacity-80 border-t border-white/20 pt-3 mt-1">
                This tool supports clinical judgment, it does not replace it.
                Always review extreme waiting times or suspicious outputs with
                your team before acting.
              </p>
            </div>
          </div>

          {/* Natural language scheduling policy (frontend only — not connected to backend) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#2b8cee] text-xl">
                edit_note
              </span>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Scheduling policy changes (natural language)
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              Enter your scheduling rules in plain language. For example: priority for ventilator patients, tie-break by arrival time, or which bed categories apply to which conditions. This will be used to configure bed assignment and priority rules when connected to the policy service.
            </p>
            <textarea
              value={schedulingPolicyText}
              onChange={(e) => {
                setSchedulingPolicyText(e.target.value);
                setFeedbackSubmitted(false);
              }}
              placeholder="e.g. Prioritize patients on ventilator. Assign critical beds to sepsis and cardiac arrest. Tie-break by earliest arrival time. Pediatric patients only in designated pediatric beds."
              rows={5}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2b8cee] focus:border-[#2b8cee] resize-y min-h-[120px]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={feedbackSubmitting}
                onClick={() => {
                  setFeedbackSubmitting(true);
                  try {
                    localStorage.setItem("icu-scheduling-policy-feedback", schedulingPolicyText);
                  } catch (_) {}
                  setTimeout(() => {
                    setFeedbackSubmitting(false);
                    setFeedbackSubmitted(true);
                  }, 3000);
                }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-[#2b8cee] hover:bg-blue-600 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {feedbackSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    Submitting…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Submit feedback
                  </>
                )}
              </button>
              {feedbackSubmitted && !feedbackSubmitting && (
                <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Feedback submitted
                </span>
              )}
            </div>
           
          </div>
        </>

        {/* Bed Management Content */}
        <>
          {/* Bed Statistics */}
          {bedStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Beds</p>
                <p className="text-2xl font-bold text-slate-900">{bedStats.total}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Available</p>
                <p className="text-2xl font-bold text-green-600">{bedStats.available}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Occupied</p>
                <p className="text-2xl font-bold text-red-600">{bedStats.occupied}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Ventilator</p>
                <p className="text-2xl font-bold text-blue-600">{bedStats.withVentilator}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Dialysis</p>
                <p className="text-2xl font-bold text-purple-600">{bedStats.withDialysis}</p>
              </div>
            </div>
          )}

          {/* Add/Edit Bed Modal */}
          {showAddBedForm && (
            <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      {editingBed ? "Edit Bed" : "Add New Bed"}
                    </h3>
                    <button
                      onClick={cancelBedForm}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Bed ID</label>
                      <input
                        type="text"
                        value={bedForm.bed_id}
                        onChange={(e) => setBedForm({ ...bedForm, bed_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., B001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Bed Type</label>
                      <select
                        value={bedForm.bed_type}
                        onChange={(e) => setBedForm({ ...bedForm, bed_type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Basic">Basic</option>
                        <option value="Advanced">Advanced</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="ventilator"
                        checked={bedForm.ventilator_available}
                        onChange={(e) => setBedForm({ ...bedForm, ventilator_available: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="ventilator" className="text-sm font-medium text-slate-700">
                        Ventilator Available
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="dialysis"
                        checked={bedForm.dialysis_available}
                        onChange={(e) => setBedForm({ ...bedForm, dialysis_available: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="dialysis" className="text-sm font-medium text-slate-700">
                        Dialysis Available
                      </label>
                    </div>
                    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-slate-500">
                            vitals
                          </span>
                          <span className="text-sm font-medium text-slate-700">
                            Multiparameter patient monitor
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setShowcaseBedFeatures((prev) => ({
                              ...prev,
                              multiparameterMonitor: !prev.multiparameterMonitor,
                            }))
                          }
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            showcaseBedFeatures.multiparameterMonitor
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              showcaseBedFeatures.multiparameterMonitor
                                ? "translate-x-4"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-slate-500">
                            local_hospital
                          </span>
                          <span className="text-sm font-medium text-slate-700">
                            Oxygen supply system
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setShowcaseBedFeatures((prev) => ({
                              ...prev,
                              oxygenSupplySystem: !prev.oxygenSupplySystem,
                            }))
                          }
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            showcaseBedFeatures.oxygenSupplySystem
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              showcaseBedFeatures.oxygenSupplySystem
                                ? "translate-x-4"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={editingBed ? handleUpdateBed : handleAddBed}
                      disabled={bedFormLoading || !bedForm.bed_id}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
                    >
                      {bedFormLoading ? "Saving..." : editingBed ? "Update Bed" : "Add Bed"}
                    </button>
                    <button
                      onClick={cancelBedForm}
                      className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Beds List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">ICU Beds ({beds.length})</h3>
            </div>
            <div className="p-5">
              {beds.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2">bed</span>
                  <p>No beds found. Click "Add Bed" to create your first ICU bed.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {beds.map((bed) => (
                    <ICUBedCard
                      key={bed.id}
                      bed={bed}
                      onEdit={startEditBed}
                      onDelete={handleDeleteBed}
                      onRound={(bedObj) => setRoundBed({ ...bedObj, bed_number: bedObj.bed_id, bed_id: bedObj.id })}
                      onDischarge={handleDischarge}
                      onShowQr={(bedObj) => setQrBed(bedObj)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      </main>

      {/* Daily Round Modal */}
      {roundBed && (
        <DailyRoundModal
          bed={roundBed}
          onClose={() => setRoundBed(null)}
          onUpdate={() => { setRoundBed(null); loadBedsData(); }}
        />
      )}

      {/* ICU Bed QR Modal */}
      {qrBed && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 relative">
            <button
              onClick={() => setQrBed(null)}
              className="absolute top-3 right-3 rounded-full w-8 h-8 flex items-center justify-center hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-slate-500 text-xl">close</span>
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              ICU Bed QR Code
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Scan this code to open the daily round form for ICU bed{' '}
              <span className="font-semibold">{qrBed.bed_id}</span>.
            </p>
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `${window.location.origin}/qr-round?icu=1&icuBedId=${qrBed.id}`
                  )}`}
                  alt="ICU Bed QR code"
                  className="w-48 h-48 object-contain"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Right-click to save and print this QR code. Place it near the ICU bed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

