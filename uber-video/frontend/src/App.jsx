import React, { useContext } from 'react'
import { Route, Routes } from 'react-router-dom'
import Start from './pages/Start'
import PatientLogin from './pages/PatientLogin'
import PatientSignup from './pages/PatientSignup'
import AmbulanceDriverLogin from './pages/AmbulanceDriverLogin'
import AmbulanceDriverSignup from './pages/AmbulanceDriverSignup'
import PatientHome from './pages/PatientHome'
import PatientProtectWrapper from './pages/PatientProtectWrapper'
import PatientLogout from './pages/PatientLogout'
import AmbulanceHome from './pages/AmbulanceHome'
import AmbulanceProtectWrapper from './pages/AmbulanceProtectWrapper'
import AmbulanceLogout from './pages/AmbulanceLogout'
import MedicalTrip from './pages/MedicalTrip'
import AmbulanceTrip from './pages/AmbulanceTrip'
import 'remixicon/fonts/remixicon.css'

const App = () => {

  return (
    <div>
      <Routes>
        <Route path='/' element={<Start />} />
        <Route path='/login' element={<PatientLogin />} />
        <Route path='/medical-trip' element={<MedicalTrip />} />
        <Route path='/ambulance-trip' element={<AmbulanceTrip />} />

        <Route path='/signup' element={<PatientSignup />} />
        <Route path='/ambulance-login' element={<AmbulanceDriverLogin />} />
        <Route path='/ambulance-signup' element={<AmbulanceDriverSignup />} />
        <Route path='/home'
          element={
            <PatientProtectWrapper>
              <PatientHome />
            </PatientProtectWrapper>
          } />
        <Route path='/patient/logout'
          element={<PatientProtectWrapper>
            <PatientLogout />
          </PatientProtectWrapper>
          } />
        <Route path='/ambulance-home' element={
          <AmbulanceProtectWrapper>
            <AmbulanceHome />
          </AmbulanceProtectWrapper>

        } />
        <Route path='/ambulance/logout' element={
          <AmbulanceProtectWrapper>
            <AmbulanceLogout />
          </AmbulanceProtectWrapper>
        } />
      </Routes>
    </div>
  )
}

export default App