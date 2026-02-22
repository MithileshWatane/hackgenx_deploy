import React, { useState, useEffect } from "react";
import {
  runOptimizedSchedule,
} from "../services/schedulingService";
import {
  getICUBeds,
  addICUBed,
  updateICUBed,
  deleteICUBed,
  getBedStats,
} from "../services/bedService";

export default function ICUScheduling() {
  const [loadingType, setLoadingType] = useState(null); // "optimized" | null
  const [error, setError] = useState("");
  const [optimizedResult, setOptimizedResult] = useState(null);
  
  const [beds, setBeds] = useState([]);
  const [bedStats, setBedStats] = useState(null);
  const [showAddBedForm, setShowAddBedForm] = useState(false);
  const [editingBed, setEditingBed] = useState(null);
  const [bedFormLoading, setBedFormLoading] = useState(false);
  const [bedForm, setBedForm] = useState({
    bed_id: "",
    bed_type: "Basic",
    ventilator_available: false,
    dialysis_available: false,
    is_available: true,
  });

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

  // Load beds data
  const loadBedsData = async () => {
    try {
      const [bedsData, statsData] = await Promise.all([
        getICUBeds(),
        getBedStats(),
      ]);
      setBeds(bedsData);
      setBedStats(statsData);
    } catch (err) {
      console.error("Error loading beds:", err);
    }
  };

  // Load beds on component mount
  useEffect(() => {
    loadBedsData();
  }, []);

  // Bed management functions
  const handleAddBed = async () => {
    setBedFormLoading(true);
    try {
      await addICUBed(bedForm);
      setBedForm({
        bed_id: "",
        bed_type: "Basic",
        ventilator_available: false,
        dialysis_available: false,
        is_available: true,
      });
      setShowAddBedForm(false);
      await loadBedsData();
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

  const cancelBedForm = () => {
    setEditingBed(null);
    setBedForm({
      bed_id: "",
      bed_type: "Basic",
      ventilator_available: false,
      dialysis_available: false,
      is_available: true,
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
              Admitted
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
            <button
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
            </button>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {beds.map((bed) => (
                      <div key={bed.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-2xl text-slate-600">bed</span>
                            <h4 className="font-semibold text-slate-900">{bed.bed_id}</h4>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            bed.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {bed.is_available ? 'Available' : 'Occupied'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Type:</span>
                            <span className="text-sm font-medium text-slate-900">{bed.bed_type}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Ventilator:</span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              bed.ventilator_available ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {bed.ventilator_available ? 'Available' : 'Not Available'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Dialysis:</span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              bed.dialysis_available ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {bed.dialysis_available ? 'Available' : 'Not Available'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => startEditBed(bed)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBed(bed.id)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
      </main>
    </div>
  );
}

