import React, { useState, useContext } from 'react'
import { Link } from 'react-router-dom'
import { PatientDataContext } from '../context/PatientContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const PatientLogin = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const { patient, setPatient } = useContext(PatientDataContext)
    const navigate = useNavigate()

    const submitHandler = async (e) => {
        e.preventDefault();

        const patientData = {
            email: email,
            password: password
        }

        const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/patients/login`, patientData)

        if (response.status === 200) {
            const data = response.data
            setPatient(data.patient)
            localStorage.setItem('token', data.token)
            navigate('/home')
        }

        setEmail('')
        setPassword('')
    }

    return (
        <div className='p-7 h-screen flex flex-col justify-between'>
            <div>
                <div className='flex items-center mb-10'>
                    <i className="ri-hospital-line text-3xl text-primary font-bold"></i>
                    <span className='text-2xl font-bold ml-2'>Ambulance</span>
                </div>

                <form onSubmit={(e) => {
                    submitHandler(e)
                }}>
                    <h3 className='text-lg font-medium mb-2'>Enter your registered email</h3>
                    <input
                        required
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value)
                        }}
                        className='bg-[#eeeeee] mb-7 rounded-lg px-4 py-2 border w-full text-lg placeholder:text-base'
                        type="email"
                        placeholder='email@example.com'
                    />

                    <h3 className='text-lg font-medium mb-2'>Enter Password</h3>

                    <input
                        className='bg-[#eeeeee] mb-7 rounded-lg px-4 py-2 border w-full text-lg placeholder:text-base'
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value)
                        }}
                        required type="password"
                        placeholder='password'
                    />

                    <button
                        className='bg-primary text-white font-semibold mb-3 rounded-lg px-4 py-2 w-full text-lg placeholder:text-base'
                    >Login</button>

                </form>
                <p className='text-center'>New Patient? <Link to='/signup' className='text-blue-600'>Create new Account</Link></p>
            </div>
            <div>
                <Link
                    to='/ambulance-login'
                    className='bg-blue-600 flex items-center justify-center text-white font-semibold mb-5 rounded-lg px-4 py-2 w-full text-lg placeholder:text-base'
                >Sign in as Ambulance Driver</Link>
            </div>
        </div>
    )
}

export default PatientLogin
