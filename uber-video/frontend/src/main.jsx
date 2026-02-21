import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom';
import PatientContext from './context/PatientContext.jsx';
import AmbulanceContext from './context/AmbulanceContext.jsx';
import SocketProvider from './context/SocketContext.jsx';

createRoot(document.getElementById('root')).render(

  <AmbulanceContext>
    <PatientContext>
      <SocketProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SocketProvider>
    </PatientContext>
  </AmbulanceContext>

)
