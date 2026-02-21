import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AmbulanceDataContext } from '../context/AmbulanceContext'

const AmbulanceDriverLogin = () => {

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const { ambulanceDriver, setAmbulanceDriver } = React.useContext(AmbulanceDataContext)
    const navigate = useNavigate()

    const submitHandler = async (e) => {
        e.preventDefault();
        const driverData = {
            email: email,
            password
        }

        const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/ambulance-drivers/login`, driverData)

        if (response.status === 200) {
            const data = response.data

            setAmbulanceDriver(data.ambulanceDriver)
            localStorage.setItem('token', data.token)
            navigate('/ambulance-home')

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
                    <span className='text-sm bg-primary text-white px-2 py-0.5 rounded ml-2'>DRIVER</span>
                </div>

                <form onSubmit={(e) => {
                    submitHandler(e)
                }}>
                    <h3 className='text-lg font-medium mb-2'>What's your email</h3>
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
                <p className='text-center'>Join our emergency fleet? <Link to='/ambulance-signup' className='text-blue-600'>Register as a Driver</Link></p>
            </div>
            <div>
                <Link
                    to='/login'
                    className='bg-orange-600 flex items-center justify-center text-white font-semibold mb-5 rounded-lg px-4 py-2 w-full text-lg placeholder:text-base'
                >Sign in as Patient</Link>
            </div>
        </div>
    )
}

export default AmbulanceDriverLogin
