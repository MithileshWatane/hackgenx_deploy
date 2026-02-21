import React, { createContext, useState } from 'react'

export const PatientDataContext = createContext()


const PatientContext = ({ children }) => {

    const [patient, setPatient] = useState({
        email: '',
        fullName: {
            firstName: '',
            lastName: ''
        }
    })

    return (
        <div>
            <PatientDataContext.Provider value={{ patient, setPatient }}>
                {children}
            </PatientDataContext.Provider>
        </div>
    )
}

export default PatientContext
