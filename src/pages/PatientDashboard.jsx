import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext_simple';
import { supabase } from '../lib/supabase';

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

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user, userRole, signOut } = useAuth();

  const [formData, setFormData] = useState({
    patient_name: '',
    age: '',
    disease: '',
    phone: '',
    email: '',
    appointment_date: '',
    doctor_id: '',
    notes: '',
    is_emergency: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [queueInfo, setQueueInfo] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [appointmentsHistory, setAppointmentsHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('book'); // 'book' or 'history'

  const fetchHistory = async () => {
    if (!user?.email) return;
    try {
      console.log('Fetching appointment history for:', user.email);
      
      // Fetch appointments for the current patient using their email
      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false });

      if (apptError) {
        console.error('Supabase error:', apptError);
        throw apptError;
      }
      
      console.log('Fetched appointments:', appointments);
      
      // If we have appointments, fetch doctor information separately
      if (appointments && appointments.length > 0) {
        const doctorIds = [...new Set(appointments.map(appt => appt.doctor_id).filter(Boolean))];
        
        if (doctorIds.length > 0) {
          const { data: doctors } = await supabase
            .from('user_profiles')
            .select('id, name, email')
            .in('id', doctorIds);
          
          // Map doctor information to appointments
          const appointmentsWithDoctors = appointments.map(appt => ({
            ...appt,
            doctor: doctors?.find(doc => doc.id === appt.doctor_id)
          }));
          
          setAppointmentsHistory(appointmentsWithDoctors);
        } else {
          setAppointmentsHistory(appointments);
        }
      } else {
        setAppointmentsHistory([]);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to load medical history: ' + err.message);
    }
  };

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, email, name')
          .eq('role', 'doctor');

        if (error) throw error;
        setDoctors(data || []);
      } catch (err) {
        console.error('Error fetching doctors:', err);
      }
    };

    fetchDoctors();
    fetchHistory();
  }, [user?.email]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate('/');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setQueueInfo(null);

    if (!formData.patient_name || !formData.age || !formData.disease || !formData.phone || !formData.email || !formData.appointment_date || !formData.doctor_id) {
      setError('Please fill in all required fields');
      return;
    }
    if (parseInt(formData.age) < 1 || parseInt(formData.age) > 150) {
      setError('Age must be between 1 and 150');
      return;
    }

    try {
      setLoading(true);

      // Step 1 – Insert appointment
      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .insert([{
          patient_name: formData.patient_name,
          age: parseInt(formData.age),
          disease: formData.disease,
          phone: formData.phone,
          email: formData.email,
          appointment_date: formData.appointment_date,
          doctor_id: formData.doctor_id,
          notes: formData.notes,
          status: 'scheduled',
          is_emergency: formData.is_emergency
        }])
        .select();

      if (apptError) throw apptError;

      const appointment = apptData?.[0];

      // Step 2 – Check if emergency patient
      if (formData.is_emergency) {
        // Add directly to ICU queue
        const tokenNumber = appointment?.token_number || `ICU-${Date.now()}`;
        
        const { error: icuError } = await supabase
          .from('icu_queue')
          .insert([{
            patient_token: tokenNumber,
            patient_name: formData.patient_name,
            diseases: formData.disease,
            doctor_id: formData.doctor_id,
            is_emergency: true,
            status: 'waiting',
            severity: 'critical',
            created_at: new Date().toISOString(),
          }]);

        if (icuError) throw icuError;

        setQueueInfo({ token: tokenNumber, isEmergency: true });
        setSuccess(`Emergency appointment booked! You have been added directly to ICU Queue.`);
      } else {
        // Regular flow - compute moving average and add to OPD queue
        const [estimatedWait, queuePosition] = await Promise.all([
          computeMovingAverage(formData.doctor_id),
          getNextQueuePosition(formData.doctor_id),
        ]);

        const tokenNumber = appointment?.token_number || `OPD-${queuePosition}`;

        const { error: opdError } = await supabase
          .from('opd_queue')
          .insert([{
            appointment_id: appointment.id,
            patient_name: formData.patient_name,
            disease: formData.disease,
            token_number: tokenNumber,
            doctor_id: formData.doctor_id,
            queue_position: queuePosition,
            status: 'waiting',
            estimated_wait_minutes: estimatedWait,
            entered_queue_at: new Date().toISOString(),
          }]);

        if (opdError) throw opdError;

        setQueueInfo({ position: queuePosition, estimatedWait: estimatedWait, token: tokenNumber });
        setSuccess(`Appointment booked successfully!`);
      }

      // Refresh history
      await fetchHistory();

      setFormData({
        patient_name: '', age: '', disease: '', phone: '',
        email: user?.email || '', appointment_date: '', doctor_id: '', notes: '', is_emergency: false
      });
    } catch (err) {
      setError('Failed to schedule appointment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 sm:px-10 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#2b8cee]/10 text-[#2b8cee]">
              <span className="material-symbols-outlined">local_hospital</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">MediFlow</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">Welcome, {user?.email?.split('@')[0]}</span>
            <button
              onClick={handleSignOut}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 px-4 text-sm font-bold text-slate-900 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-10 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-[#2b8cee]/10 text-[#2b8cee]">
                <span className="material-symbols-outlined text-4xl">person</span>
              </div>
              <div className="text-center md:text-left">
                <h1 className="text-2xl font-bold text-slate-900">Patient Dashboard</h1>
                <p className="text-slate-600">Manage your appointments and medical health profile</p>
              </div>
            </div>

            {/* Dashboard Tabs */}
            <div className="flex border-b border-slate-200 mb-8">
              <button
                onClick={() => setActiveTab('book')}
                className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'book'
                  ? 'border-[#2b8cee] text-[#2b8cee] bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Book Appointment
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'history'
                  ? 'border-[#2b8cee] text-[#2b8cee] bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span className="material-symbols-outlined text-lg">medical_information</span>
                Medical History
                {appointmentsHistory.length > 0 && (
                  <span className="bg-[#2b8cee] text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                    {appointmentsHistory.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'book' ? (
              /* Appointment Scheduling Form */
              <div className="animate-in fade-in duration-500">
                {/* Alerts */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3 animate-shake">
                    <span className="material-symbols-outlined">error</span>
                    {error}
                  </div>
                )}

                {/* Queue Success Banner */}
                {success && queueInfo && (
                  <div className="mb-8 rounded-2xl overflow-hidden shadow-lg border border-green-200 animate-in slide-in-from-top duration-500">
                    <div className={`${queueInfo.isEmergency ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-green-500 to-emerald-600'} px-6 py-4 flex items-center gap-3`}>
                      <span className="material-symbols-outlined text-white text-3xl">
                        {queueInfo.isEmergency ? 'emergency' : 'check_circle'}
                      </span>
                      <div>
                        <p className="text-white font-bold text-lg">{success}</p>
                        <p className={`${queueInfo.isEmergency ? 'text-red-100' : 'text-green-100'} text-sm`}>
                          {queueInfo.isEmergency ? 'Emergency patient prioritized for ICU' : 'You are now in the live OPD priority queue'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white px-6 py-6 grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Token ID</p>
                        <p className="text-xl font-black text-[#2b8cee]">{queueInfo.token}</p>
                      </div>
                      {!queueInfo.isEmergency && (
                        <>
                          <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Queue Post</p>
                            <p className="text-2xl font-black text-slate-900">#{queueInfo.position}</p>
                          </div>
                          <div className="text-center p-4 bg-amber-50 rounded-2xl border border-amber-100">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Approx. Wait</p>
                            <p className="text-2xl font-black text-amber-700">{queueInfo.estimatedWait} min</p>
                          </div>
                        </>
                      )}
                      {queueInfo.isEmergency && (
                        <>
                          <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-200">
                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Priority</p>
                            <p className="text-2xl font-black text-red-700">EMERGENCY</p>
                          </div>
                          <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-200">
                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Queue Type</p>
                            <p className="text-2xl font-black text-red-700">ICU</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">Schedule New Appointment</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">person</span>
                        Patient Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="patient_name"
                        value={formData.patient_name}
                        onChange={handleInputChange}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] bg-slate-50 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">cake</span>
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
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] bg-slate-50 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">call</span>
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+91 98765 43210"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] bg-slate-50 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">mail</span>
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="john@example.com"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] bg-slate-50 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">medical_services</span>
                      Symptoms / Reason for Visit <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="disease"
                      value={formData.disease}
                      onChange={handleInputChange}
                      placeholder="Describe your health concern"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] bg-slate-50 transition-all font-medium"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">stethoscope</span>
                        Preferred Doctor <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="doctor_id"
                        value={formData.doctor_id}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] bg-slate-50 transition-all font-medium appearance-none"
                      >
                        <option value="">Select a doctor</option>
                        {doctors.map(doctor => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.name || doctor.email.split('@')[0]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">calendar_month</span>
                        Date and Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="appointment_date"
                        value={formData.appointment_date}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] bg-slate-50 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">description</span>
                      Additional Notes <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="List any medical history or allergies..."
                      rows="3"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] bg-slate-50 transition-all font-medium resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                    <input
                      type="checkbox"
                      id="is_emergency"
                      name="is_emergency"
                      checked={formData.is_emergency}
                      onChange={handleInputChange}
                      className="w-5 h-5 text-red-600 border-red-300 rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="is_emergency" className="flex items-center gap-2 cursor-pointer flex-1">
                      <span className="material-symbols-outlined text-red-600 text-2xl">emergency</span>
                      <div>
                        <p className="text-sm font-bold text-red-700">Emergency Patient</p>
                        <p className="text-xs text-red-600">Skip OPD queue and add directly to ICU queue</p>
                      </div>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full ${formData.is_emergency ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-red-200' : 'bg-gradient-to-r from-[#2b8cee] to-[#1a73e8] hover:from-[#1a73e8] hover:to-[#174ea6] shadow-blue-200'} hover:shadow-lg text-white font-bold py-4 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3 shadow-md text-lg`}
                  >
                    {loading ? (
                      <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined">
                        {formData.is_emergency ? 'emergency' : 'send'}
                      </span>
                    )}
                    {loading 
                      ? 'Processing...' 
                      : (formData.is_emergency ? 'Book Emergency & Add to ICU' : 'Confirm Booking & Join Queue')
                    }
                  </button>
                </form>
              </div>
            ) : (
              /* Booking History List */
              <div className="animate-in slide-in-from-right duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">Your Medical History</h2>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-lg font-medium">
                    {appointmentsHistory.length} records
                  </span>
                </div>

                {appointmentsHistory.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">medical_information</span>
                    <p className="text-slate-500 font-medium mb-2">No medical history found</p>
                    <p className="text-slate-400 text-sm mb-4">Your appointment records will appear here once you book your first visit</p>
                    <button
                      onClick={() => setActiveTab('book')}
                      className="inline-flex items-center gap-2 bg-[#2b8cee] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#1a73e8] transition-colors"
                    >
                      <span className="material-symbols-outlined">add_circle</span>
                      Book First Appointment
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {appointmentsHistory.map((appt) => (
                      <div
                        key={appt.id}
                        className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#2b8cee]/50 transition-all hover:shadow-md relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#2b8cee]/10 group-hover:bg-[#2b8cee] transition-all"></div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex size-14 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shrink-0">
                              <span className="material-symbols-outlined text-3xl">medical_information</span>
                            </div>
                            <div className="flex-1">
                              {/* Primary Diagnosis/Reason for Visit */}
                              <div className="mb-3">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Chief Complaint</p>
                                <p className="text-lg font-bold text-slate-900 mb-2">
                                  {appt.disease || 'General consultation'}
                                </p>
                              </div>

                              {/* Doctor Information */}
                              <div className="mb-3">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Consulting Doctor</p>
                                <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                  <span className="material-symbols-outlined text-[16px] text-blue-500">stethoscope</span>
                                  Dr. {appt.doctor?.name || appt.doctor?.email?.split('@')[0] || 'Medical Specialist'}
                                </div>
                              </div>

                              {/* Visit Details Grid */}
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                <div>
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Visit Date</p>
                                  <div className="flex items-center gap-1 text-sm text-slate-600">
                                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                    {new Date(appt.appointment_date).toLocaleDateString('en-IN', {
                                      day: '2-digit', month: 'short', year: 'numeric'
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Time</p>
                                  <div className="flex items-center gap-1 text-sm text-slate-600">
                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                    {new Date(appt.appointment_date).toLocaleTimeString('en-IN', {
                                      hour: '2-digit', minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Patient Age</p>
                                  <div className="flex items-center gap-1 text-sm text-slate-600">
                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                    {appt.age} years
                                  </div>
                                </div>
                              </div>

                              {/* Additional Notes */}
                              {appt.notes && (
                                <div className="mb-3">
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Clinical Notes</p>
                                  <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100">
                                    {appt.notes}
                                  </p>
                                </div>
                              )}

                              {/* Queue Status if still waiting */}
                              {appt.status === 'scheduled' && (
                                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 w-fit">
                                  <span className="material-symbols-outlined text-[16px] text-blue-600">event</span>
                                  <div>
                                    <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Appointment Status</p>
                                    <p className="text-sm font-bold text-blue-800">Scheduled - Awaiting consultation</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3 shrink-0">
                            {/* Status Badge */}
                            <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              appt.status === 'scheduled' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              appt.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                              appt.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200' :
                              'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              <span className="material-symbols-outlined text-[12px] mr-1">
                                {appt.status === 'scheduled' ? 'event' : 
                                 appt.status === 'completed' ? 'check_circle' : 
                                 appt.status === 'cancelled' ? 'cancel' : 'help'}
                              </span>
                              {appt.status}
                            </span>

                            {/* Appointment Reference */}
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Appointment ID</p>
                              <p className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                {appt.token_number || appt.id.split('-')[0]}
                              </p>
                            </div>

                            {/* Contact Information */}
                            <div className="text-right text-xs text-slate-500">
                              <p className="font-medium">{appt.phone}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
