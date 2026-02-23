import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext_simple';
import { supabase } from '../lib/supabase';

// Moving average of last N completed patients' actual wait times
const DEFAULT_WAIT_MINUTES = 15;
const MOVING_AVG_WINDOW = 5;

async function computeMovingAverage(doctorId) {
  try {
    const { data, error } = await supabase
      .from('opd_queue')
      .select('actual_wait_minutes')
      .eq('doctor_id', doctorId)
      .eq('status', 'completed')
      .not('actual_wait_minutes', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(MOVING_AVG_WINDOW);

    if (error || !data || data.length === 0) return DEFAULT_WAIT_MINUTES;

    const avg = data.reduce((sum, r) => sum + parseFloat(r.actual_wait_minutes), 0) / data.length;
    return Math.round(avg);
  } catch {
    return DEFAULT_WAIT_MINUTES;
  }
}

async function getNextQueuePosition(doctorId) {
  const { count } = await supabase
    .from('opd_queue')
    .select('id', { count: 'exact', head: true })
    .eq('doctor_id', doctorId)
    .in('status', ['waiting', 'in_progress']);
  return (count || 0) + 1;
}

export default function AppointmentScheduling() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    patient_name: '',
    age: '',
    disease: '',
    phone: '',
    email: '',
    appointment_date: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [queueInfo, setQueueInfo] = useState(null); // { position, estimatedWait, token }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setQueueInfo(null);

    if (!formData.patient_name || !formData.age || !formData.disease || !formData.phone || !formData.email || !formData.appointment_date) {
      setError('Please fill in all required fields');
      return;
    }
    if (parseInt(formData.age) < 1 || parseInt(formData.age) > 150) {
      setError('Age must be between 1 and 150');
      return;
    }

    try {
      setLoading(true);

      // Step 1 – Compute moving average and next queue position in parallel
      const [estimatedWait, queuePosition] = await Promise.all([
        computeMovingAverage(user?.id),
        getNextQueuePosition(user?.id),
      ]);

      // Step 2 – Insert appointment
      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .insert([{
          patient_name: formData.patient_name,
          age: parseInt(formData.age),
          disease: formData.disease,
          phone: formData.phone,
          email: formData.email,
          appointment_date: formData.appointment_date,
          notes: formData.notes,
          doctor_id: user?.id,
          status: 'scheduled'
        }])
        .select();

      if (apptError) throw apptError;

      const appointment = apptData?.[0];
      const tokenNumber = appointment?.token_number || `OPD-${queuePosition}`;

      // Step 3 – Add patient to OPD queue
      const { error: queueError } = await supabase
        .from('opd_queue')
        .insert([{
          appointment_id: appointment?.id,
          patient_name: formData.patient_name,
          disease: formData.disease,
          token_number: tokenNumber,
          doctor_id: user?.id,
          queue_position: queuePosition,
          status: 'waiting',
          estimated_wait_minutes: estimatedWait,
          entered_queue_at: new Date().toISOString(),
        }]);

      if (queueError) throw queueError;

      setQueueInfo({ position: queuePosition, estimatedWait, token: tokenNumber });
      setSuccess(`Appointment booked! Patient added to OPD Queue.`);
      setFormData({
        patient_name: '', age: '', disease: '', phone: '',
        email: '', appointment_date: '', notes: ''
      });
    } catch (err) {
      setError('Failed to schedule appointment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Appointment Scheduling</h1>
          <p className="text-slate-600 text-lg">Manage and schedule patient appointments — patients are auto-added to OPD queue</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Alerts */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3 animate-pulse">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          {/* Queue Success Banner */}
          {success && queueInfo && (
            <div className="mb-6 rounded-2xl overflow-hidden shadow-lg border border-green-200">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-white text-3xl">check_circle</span>
                <div>
                  <p className="text-white font-bold text-lg">{success}</p>
                  <p className="text-green-100 text-sm">Patient is now in the OPD waiting queue</p>
                </div>
              </div>
              <div className="bg-white px-6 py-4 grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Token</p>
                  <p className="text-2xl font-bold text-[#2b8cee]">{queueInfo.token}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Queue Position</p>
                  <p className="text-2xl font-bold text-slate-900">#{queueInfo.position}</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs font-semibold text-amber-600 uppercase mb-1">Est. Wait Time</p>
                  <p className="text-2xl font-bold text-amber-700">~{queueInfo.estimatedWait} min</p>
                </div>
              </div>
            </div>
          )}

          {success && !queueInfo && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-3">
              <span className="material-symbols-outlined">check_circle</span>
              {success}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-[#2b8cee] text-3xl">event_available</span>
              <h2 className="text-2xl font-bold text-slate-900">New Appointment</h2>
            </div>

            {/* Moving average info chip */}
            <div className="mb-6 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Wait time is predicted using the moving average of the last {MOVING_AVG_WINDOW} consultations
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="patient_name"
                  value={formData.patient_name}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b8cee] focus:border-transparent bg-slate-50 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    placeholder="30"
                    min="1"
                    max="150"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b8cee] focus:border-transparent bg-slate-50 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+1234567890"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b8cee] focus:border-transparent bg-slate-50 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Disease/Condition <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="disease"
                  value={formData.disease}
                  onChange={handleInputChange}
                  placeholder="e.g., Fever, Headache"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b8cee] focus:border-transparent bg-slate-50 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="patient@example.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b8cee] focus:border-transparent bg-slate-50 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Appointment Date &amp; Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="appointment_date"
                  value={formData.appointment_date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b8cee] focus:border-transparent bg-slate-50 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Notes <span className="text-slate-400">(Optional)</span>
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Add any additional notes or special requirements..."
                  rows="3"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b8cee] focus:border-transparent bg-slate-50 transition resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#2b8cee] to-[#1e6bb8] hover:shadow-lg text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
              >
                <span className="material-symbols-outlined">queue</span>
                {loading ? 'Scheduling & Adding to Queue...' : 'Schedule & Add to OPD Queue'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
