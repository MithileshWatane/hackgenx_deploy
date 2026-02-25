import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext_simple';
import { supabase } from '../../lib/supabase';
import { allocateEmergencyICUBed } from '../../services/emergencyBedAllocationService';
import { useDoctorsList } from '../../hooks/useDoctorsList';
import {
  computeMovingAverage,
  getNextQueuePosition,
  PATIENT_MOVING_AVG_WINDOW,
} from '../../utils/patientQueueHelpers';

export default function PatientAppointments() {
  const { user } = useAuth();
  const { doctors } = useDoctorsList();

  const [formData, setFormData] = useState({
    patient_name: '',
    age: '',
    disease: '',
    phone: '',
    email: user?.email || '',
    appointment_date: '',
    doctor_id: '',
    notes: '',
    is_emergency: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [queueInfo, setQueueInfo] = useState(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);

  React.useEffect(() => {
    const fetchNearbyHospitals = async (lat, lon) => {
      setHospitalsLoading(true);
      try {
        const res = await fetch('http://localhost:5000/api/hospitals/nearby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: lat || 18.5204,
            longitude: lon || 73.8567,
          }),
        });

        const data = await res.json();
        if (data.status === 'success') {
          setHospitals(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch hospitals:', err);
      } finally {
        setHospitalsLoading(false);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchNearbyHospitals(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('Geolocation failed, using default coords:', error);
          fetchNearbyHospitals(); // Fallback
        }
      );
    } else {
      fetchNearbyHospitals();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setQueueInfo(null);

    if (
      !formData.patient_name ||
      !formData.age ||
      !formData.disease ||
      !formData.phone ||
      !formData.email ||
      !formData.appointment_date ||
      !formData.doctor_id
    ) {
      setError('Please fill in all required fields');
      return;
    }
    if (parseInt(formData.age, 10) < 1 || parseInt(formData.age, 10) > 150) {
      setError('Age must be between 1 and 150');
      return;
    }

    try {
      setLoading(true);

      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .insert([
          {
            patient_name: formData.patient_name,
            age: parseInt(formData.age, 10),
            disease: formData.disease,
            phone: formData.phone,
            email: formData.email,
            appointment_date: formData.appointment_date,
            doctor_id: formData.doctor_id,
            notes: formData.notes,
            status: 'scheduled',
            is_emergency: formData.is_emergency,
          },
        ])
        .select();

      if (apptError) throw apptError;

      const appointment = apptData?.[0];

      if (formData.is_emergency) {
        const tokenNumber = appointment?.token_number || `ICU-${Date.now()}`;

        const { data: icuQueueData, error: icuError } = await supabase
          .from('icu_queue')
          .insert([
            {
              patient_token: tokenNumber,
              patient_name: formData.patient_name,
              diseases: formData.disease,
              doctor_id: formData.doctor_id,
              is_emergency: true,
              status: 'waiting',
              severity: 'critical',
              ventilator_needed: false,
              dialysis_needed: false,
              predicted_stay_days: 7,
              created_at: new Date().toISOString(),
            },
          ])
          .select();

        if (icuError) throw icuError;

        const icuQueueEntry = icuQueueData?.[0];

        if (icuQueueEntry) {
          const allocationResult = await allocateEmergencyICUBed({
            icuQueueId: icuQueueEntry.id,
            doctorId: formData.doctor_id,
            patientRequirements: {
              ventilator_needed: false,
              dialysis_needed: false,
            },
            predictedStayDays: 7,
          });

          if (allocationResult.success) {
            if (allocationResult.bedFreed) {
              setSuccess(
                `Emergency appointment booked! ICU bed ${allocationResult.bed.bed_id} assigned (transferred ${allocationResult.transferredPatient} to general ward).`,
              );
            } else {
              setSuccess(
                `Emergency appointment booked! ICU bed ${allocationResult.bed.bed_id} assigned.`,
              );
            }
          } else {
            setSuccess(
              'Emergency appointment booked! You have been added to ICU Queue (no beds currently available).',
            );
          }
        }

        setQueueInfo({ token: tokenNumber, isEmergency: true });
      } else {
        const [estimatedWait, queuePosition] = await Promise.all([
          computeMovingAverage(formData.doctor_id),
          getNextQueuePosition(formData.doctor_id),
        ]);

        const tokenNumber = appointment?.token_number || `OPD-${queuePosition}`;

        const { error: opdError } = await supabase.from('opd_queue').insert([
          {
            appointment_id: appointment.id,
            patient_name: formData.patient_name,
            disease: formData.disease,
            token_number: tokenNumber,
            doctor_id: formData.doctor_id,
            queue_position: queuePosition,
            status: 'waiting',
            estimated_wait_minutes: estimatedWait,
            entered_queue_at: new Date().toISOString(),
          },
        ]);

        if (opdError) throw opdError;

        setQueueInfo({
          position: queuePosition,
          estimatedWait,
          token: tokenNumber,
        });
        setSuccess('Appointment booked successfully!');
      }

      setFormData({
        patient_name: '',
        age: '',
        disease: '',
        phone: '',
        email: user?.email || '',
        appointment_date: '',
        doctor_id: '',
        notes: '',
        is_emergency: false,
      });
    } catch (err) {
      setError('Failed to schedule appointment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {success && queueInfo && (
        <div className="mb-8 rounded-2xl overflow-hidden shadow-lg border border-green-200">
          <div
            className={`${queueInfo.isEmergency
              ? 'bg-gradient-to-r from-red-500 to-red-600'
              : 'bg-gradient-to-r from-green-500 to-emerald-600'
              } px-6 py-4 flex items-center gap-3`}
          >
            <span className="material-symbols-outlined text-white text-3xl">
              {queueInfo.isEmergency ? 'emergency' : 'check_circle'}
            </span>
            <div>
              <p className="text-white font-bold text-lg">{success}</p>
              <p
                className={`${queueInfo.isEmergency ? 'text-red-100' : 'text-green-100'
                  } text-sm`}
              >
                {queueInfo.isEmergency
                  ? 'Emergency patient prioritized for ICU'
                  : 'You are now in the live OPD priority queue'}
              </p>
            </div>
          </div>
          <div className="bg-white px-6 py-6 grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Token ID
              </p>
              <p className="text-xl font-black text-[#2b8cee]">
                {queueInfo.token}
              </p>
            </div>
            {!queueInfo.isEmergency && (
              <>
                <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Queue Pos
                  </p>
                  <p className="text-2xl font-black text-slate-900">
                    #{queueInfo.position}
                  </p>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                    Approx. Wait
                  </p>
                  <p className="text-2xl font-black text-amber-700">
                    {queueInfo.estimatedWait} min
                  </p>
                </div>
              </>
            )}
            {queueInfo.isEmergency && (
              <>
                <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-200">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">
                    Priority
                  </p>
                  <p className="text-2xl font-black text-red-700">EMERGENCY</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-200">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">
                    Queue Type
                  </p>
                  <p className="text-2xl font-black text-red-700">ICU</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-[#2b8cee] text-2xl">
          add_circle
        </span>
        <h2 className="text-xl font-bold text-slate-900">
          Schedule a new appointment
        </h2>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Choose your doctor, pick a time slot, and we&apos;ll place you in the
        live OPD queue. Emergency visits are routed to ICU.
      </p>

      {/* Conversational Smart Questions - Standard Light UI Layer */}
      {hospitals.length > 0 && !hospitalsLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Question for General Checkup - Selected based on shortest wait */}
          {(() => {
            const fastestHospital = hospitals.reduce((prev, curr) =>
              prev.opd_waiting_minutes < curr.opd_waiting_minutes ? prev : curr
            );
            return (
              <div className="p-5 bg-blue-50/80 border border-blue-100 rounded-3xl group hover:bg-blue-100/50 transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-block px-2 py-1 bg-blue-600 text-[10px] text-white font-black rounded-lg uppercase tracking-wider mb-2">Fast Checkup?</span>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Need a consultation today? 🩺</h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-4xl font-black text-blue-700">{fastestHospital.opd_waiting_minutes}m</span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Wait Time</span>
                    </div>
                    <p className="text-slate-500 text-[10px] mt-1">
                      at <span className="font-bold text-slate-700">{fastestHospital.hospital_name}</span> (approx. shortest wait)
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const form = document.getElementById('appointment-form');
                      if (form) form.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="size-10 flex items-center justify-center bg-white text-blue-600 rounded-2xl shadow-sm border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-blue-100/50 active:scale-90"
                  >
                    <span className="material-symbols-outlined font-bold">arrow_forward</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Question for ICU/Emergency */}
          <div className="p-5 bg-emerald-50/80 border border-emerald-100 rounded-3xl group hover:bg-emerald-100/50 transition-all duration-300">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-block px-2 py-1 bg-emerald-600 text-[10px] text-white font-black rounded-lg uppercase tracking-wider mb-2">ICU Required?</span>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Is it an ICU emergency? 🚑</h3>
                <p className="text-slate-600 text-xs">
                  {hospitals.find(h => h.icu_beds_available > 0)?.hospital_name || hospitals[0].hospital_name} has
                  <span className="font-bold text-emerald-700"> {hospitals.find(h => h.icu_beds_available > 0)?.icu_beds_available || 0} ICU beds</span> ready right now.
                </p>
              </div>
              <button
                onClick={() => {
                  setFormData(prev => ({ ...prev, is_emergency: true }));
                  const form = document.getElementById('appointment-form');
                  if (form) form.scrollIntoView({ behavior: 'smooth' });
                }}
                className="size-10 flex items-center justify-center bg-white text-emerald-600 rounded-2xl shadow-sm border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-emerald-100/50 active:scale-90"
              >
                <span className="material-symbols-outlined font-bold">emergency_share</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nearby Hospitals Section - Modern List Style */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-[#2b8cee] text-lg font-bold">location_on</span>
            Top Capacity Hospitals Nearby
          </h3>
          {hospitalsLoading && (
            <span className="text-xs text-slate-400 animate-pulse font-medium">Checking live status...</span>
          )}
        </div>

        <div className="overflow-x-auto pb-4 -mx-1 px-1 scrollbar-hide">
          <div className="flex gap-4 min-w-max">
            {hospitals.length > 0 ? (
              hospitals.map((hospital, index) => (
                <div
                  key={index}
                  className={`flex flex-col gap-3 p-5 rounded-3xl border transition-all duration-300 ${index === 0
                    ? 'bg-white border-[#2b8cee]/30 shadow-lg shadow-[#2b8cee]/5'
                    : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                >
                  <div className="flex items-center gap-3">

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{hospital.hospital_name}</span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-[9px] text-blue-700 font-black rounded-full uppercase tracking-tighter">
                            MOST RELIABLE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">{hospital.address}</p>
                    </div>
                  </div>

                  <div className="h-px bg-slate-50 w-full"></div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">OPD Wait</span>
                      <div className="flex items-center gap-1.5">
                        <div className="size-1.5 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-black text-slate-700">{hospital.opd_waiting_minutes}m</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ICU Beds</span>
                      <div className="flex items-center gap-1.5">
                        <div className="size-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-xs font-black text-slate-700">{hospital.icu_beds_available}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-red-500">emergency_heat</span>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">ICU Wait: {hospital.icu_waiting_minutes}m</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-blue-500">near_me</span>
                      <span className="text-xs font-bold text-slate-500">{hospital.distance_km}km</span>
                    </div>
                  </div>
                </div>
              ))
            ) : !hospitalsLoading ? (
              <div className="text-xs text-slate-400 italic py-2">No recommended hospitals found in your vicinity.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
        <span className="material-symbols-outlined text-[18px]">
          auto_awesome
        </span>
        Wait time is predicted using the moving average of the last{' '}
        {PATIENT_MOVING_AVG_WINDOW} consultations.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
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
            <label className="block text-sm font-bold text-slate-700 mb-2">
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
            <label className="block text-sm font-bold text-slate-700 mb-2">
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
            <label className="block text-sm font-bold text-slate-700 mb-2">
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
          <label className="block text-sm font-bold text-slate-700 mb-2">
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
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Preferred Doctor <span className="text-red-500">*</span>
            </label>
            <select
              name="doctor_id"
              value={formData.doctor_id}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] bg-slate-50 transition-all font-medium appearance-none"
            >
              <option value="">Select a doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name || doctor.email.split('@')[0]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
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
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Additional Notes{' '}
            <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="List any medical history or allergies..."
            rows={3}
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
          <label
            htmlFor="is_emergency"
            className="flex items-center gap-2 cursor-pointer flex-1"
          >
            <span className="material-symbols-outlined text-red-600 text-2xl">
              emergency
            </span>
            <div>
              <p className="text-sm font-bold text-red-700">Emergency visit</p>
              <p className="text-xs text-red-600">
                Skip OPD queue and add directly to ICU triage queue.
              </p>
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full ${formData.is_emergency
            ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-red-200'
            : 'bg-gradient-to-r from-[#2b8cee] to-[#1a73e8] hover:from-[#1a73e8] hover:to-[#174ea6] shadow-blue-200'
            } hover:shadow-lg text-white font-bold py-4 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3 shadow-md text-lg`}
        >
          {loading ? (
            <span className="material-symbols-outlined animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined">
              {formData.is_emergency ? 'emergency' : 'send'}
            </span>
          )}
          {loading
            ? 'Processing...'
            : formData.is_emergency
              ? 'Book Emergency & Add to ICU'
              : 'Confirm Booking & Join Queue'}
        </button>
      </form>
    </div>
  );
}

