import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext_simple';
import MapLocationPicker from '../components/MapLocationPicker';

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('doctor')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [name, setName] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [country, setCountry] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Doctor location coordinates
  const [doctorLocation, setDoctorLocation] = useState({ lat: 19.0760, lng: 72.8777 });

  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (!role) {
      setError('Please select your role')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    const { error } = await signUp(email, password, role, name, {
      street,
      city,
      state,
      zipCode,
      country,
      // Only include coordinates for doctors
      latitude: role === 'doctor' ? doctorLocation.lat : null,
      longitude: role === 'doctor' ? doctorLocation.lng : null
    })

    if (error) {
      setError(error.message)
    } else {
      // Show success message and redirect to sign in
      navigate('/signin', {
        state: { message: 'Account created successfully! Please sign in.' }
      })
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-[#2b8cee]/10 text-[#2b8cee]">
              <span className="material-symbols-outlined text-2xl">local_hospital</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
            Create your MediFlow account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Join our healthcare platform
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-slate-700">
                I am a
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('doctor')}
                  className={`flex items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${role === 'doctor'
                    ? 'border-[#2b8cee] bg-[#2b8cee]/10 text-[#2b8cee]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span className="material-symbols-outlined mr-2">stethoscope</span>
                  Doctor
                </button>
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`flex items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${role === 'patient'
                    ? 'border-[#2b8cee] bg-[#2b8cee]/10 text-[#2b8cee]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span className="material-symbols-outlined mr-2">person</span>
                  Patient
                </button>
              </div>
              {role === 'patient' && (
                <p className="mt-2 text-xs text-slate-500">
                  Patient accounts don't require location information.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-[#2b8cee] focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-[#2b8cee] focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-[#2b8cee] focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-[#2b8cee] focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#2b8cee]">home</span>
                Address Information
              </h3>

              {/* Map Location Picker - Only for Doctors */}
              {role === 'doctor' && (
                <div className="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500">location_on</span>
                    Hospital Location <span className="text-xs font-normal text-slate-500">(Required)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Select your hospital location on the map. This helps patients find nearby healthcare facilities.
                  </p>
                  <MapLocationPicker
                    onLocationSelect={setDoctorLocation}
                    initialLocation={doctorLocation}
                  />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="street" className="block text-sm font-medium text-slate-700">
                    Street Address
                  </label>
                  <input
                    id="street"
                    name="street"
                    type="text"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-[#2b8cee] focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20"
                    placeholder="Enter your street address (optional)"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-slate-700">
                      City
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-[#2b8cee] focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20"
                      placeholder="Enter city (optional)"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-slate-700">
                      State
                    </label>
                    <input
                      id="state"
                      name="state"
                      type="text"
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-[#2b8cee] focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20"
                      placeholder="Enter state (optional)"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="zipCode" className="block text-sm font-medium text-slate-700">
                      Zip / Postal Code
                    </label>
                    <input
                      id="zipCode"
                      name="zipCode"
                      type="text"
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-[#2b8cee] focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20"
                      placeholder="Enter zip code (optional)"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-slate-700">
                      Country
                    </label>
                    <input
                      id="country"
                      name="country"
                      type="text"
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-[#2b8cee] focus:outline-none focus:ring-2 focus:ring-[#2b8cee]/20"
                      placeholder="Enter country (optional)"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg bg-[#2b8cee] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2b8cee]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b8cee] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/signin" className="font-medium text-[#2b8cee] hover:text-[#2b8cee]/80">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
