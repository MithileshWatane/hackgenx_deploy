import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AmbulanceDataContext } from '../context/AmbulanceContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const AmbulanceDriverSignup = () => {

    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')

    const [ambulanceColor, setAmbulanceColor] = useState('')
    const [ambulancePlate, setAmbulancePlate] = useState('')
    const [ambulanceCapacity, setAmbulanceCapacity] = useState('')
    const [ambulanceType, setAmbulanceType] = useState('')


    const { ambulanceDriver, setAmbulanceDriver } = React.useContext(AmbulanceDataContext)


    const submitHandler = async (e) => {
        e.preventDefault()
        const driverData = {
            fullname: {
                firstname: firstName,
                lastname: lastName
            },
            email: email,
            password: password,
            ambulance: {
                color: ambulanceColor,
                plate: ambulancePlate,
                capacity: ambulanceCapacity,
                ambulanceType: ambulanceType
            }
        }

        const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/ambulance-drivers/register`, driverData)

        if (response.status === 201) {
            const data = response.data
            setAmbulanceDriver(data.ambulanceDriver)
            localStorage.setItem('token', data.token)
            navigate('/ambulance-home')
        }

        setEmail('')
        setFirstName('')
        setLastName('')
        setPassword('')
        setAmbulanceColor('')
        setAmbulancePlate('')
        setAmbulanceCapacity('')
        setAmbulanceType('')

    }
    return (
        <div className='py-5 px-5 h-screen flex flex-col justify-between'>
            <div>
                <div className='flex items-center mb-6'>
                    <i className="ri-hospital-line text-3xl text-primary font-bold"></i>
                    <span className='text-2xl font-bold ml-2'>Ambulance</span>
                    <span className='text-sm bg-primary text-white px-2 py-0.5 rounded ml-2'>DRIVER</span>
                </div>

                <form onSubmit={(e) => {
                    submitHandler(e)
                }}>

                    <h3 className='text-lg w-full  font-medium mb-2'>What's our Driver's name</h3>
                    <div className='flex gap-4 mb-7'>
                        <input
                            required
                            className='bg-[#eeeeee] w-1/2 rounded-lg px-4 py-2 border  text-lg placeholder:text-base'
                            type="text"
                            placeholder='First name'
                            value={firstName}
                            onChange={(e) => {
                                setFirstName(e.target.value)
                            }}
                        />
                        <input
                            required
                            className='bg-[#eeeeee] w-1/2  rounded-lg px-4 py-2 border  text-lg placeholder:text-base'
                            type="text"
                            placeholder='Last name'
                            value={lastName}
                            onChange={(e) => {
                                setLastName(e.target.value)
                            }}
                        />
                    </div>

                    <h3 className='text-lg font-medium mb-2'>What's our Driver's email</h3>
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

                    <h3 className='text-lg font-medium mb-2'>Ambulance Information</h3>
                    <div className='flex gap-4 mb-7'>
                        <input
                            required
                            className='bg-[#eeeeee] w-1/2 rounded-lg px-4 py-2 border text-lg placeholder:text-base'
                            type="text"
                            placeholder='Ambulance Color'
                            value={ambulanceColor}
                            onChange={(e) => {
                                setAmbulanceColor(e.target.value)
                            }}
                        />
                        <input
                            required
                            className='bg-[#eeeeee] w-1/2 rounded-lg px-4 py-2 border text-lg placeholder:text-base'
                            type="text"
                            placeholder='Ambulance Plate'
                            value={ambulancePlate}
                            onChange={(e) => {
                                setAmbulancePlate(e.target.value)
                            }}
                        />
                    </div>
                    <div className='flex gap-4 mb-7'>
                        <input
                            required
                            className='bg-[#eeeeee] w-1/2 rounded-lg px-4 py-2 border text-lg placeholder:text-base'
                            type="number"
                            placeholder='Capacity'
                            value={ambulanceCapacity}
                            onChange={(e) => {
                                setAmbulanceCapacity(e.target.value)
                            }}
                        />
                        <select
                            required
                            className='bg-[#eeeeee] w-1/2 rounded-lg px-4 py-2 border text-lg placeholder:text-base'
                            value={ambulanceType}
                            onChange={(e) => {
                                setAmbulanceType(e.target.value)
                            }}
                        >
                            <option value="" disabled>Select Type</option>
                            <option value="Basic">Basic</option>
                            <option value="ICU">ICU</option>
                            <option value="Ventilator">Ventilator</option>
                        </select>
                    </div>

                    <button
                        className='bg-primary text-white font-semibold mb-3 rounded-lg px-4 py-2 w-full text-lg placeholder:text-base'
                    >Create Driver Account</button>

                </form>
                <p className='text-center'>Already registered? <Link to='/ambulance-login' className='text-blue-600'>Login here</Link></p>
            </div>
            <div>
                <p className='text-[10px] mt-6 leading-tight'>This site is protected by reCAPTCHA and the <span className='underline'>Google Privacy
                    Policy</span> and <span className='underline'>Terms of Service apply</span>.</p>
            </div>
        </div>
    )
}

export default AmbulanceDriverSignup
