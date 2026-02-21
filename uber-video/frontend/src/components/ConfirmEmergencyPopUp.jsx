import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const ConfirmEmergencyPopUp = (props) => {
    const [otp, setOtp] = useState('')
    const navigate = useNavigate()

    const submitHander = async (e) => {
        e.preventDefault()

        const response = await axios.get(`${import.meta.env.VITE_BASE_URL}/emergencies/start-trip`, {
            params: {
                emergencyRequestId: props.ride._id,
                otp: otp
            },
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        })

        if (response.status === 200) {
            props.setConfirmEmergencyPopupPanel(false)
            props.setEmergencyPopupPanel(false)
            navigate('/ambulance-trip', { state: { ride: props.ride } })
        }


    }
    return (
        <div>
            <h5 className='p-1 text-center w-[93%] absolute top-0' onClick={() => {
                props.setEmergencyPopupPanel(false)
            }}><i className="text-3xl text-gray-200 ri-arrow-down-wide-line"></i></h5>
            <h3 className='text-2xl font-bold mb-5 text-primary'>Confirm Patient Pickup</h3>
            <div className='flex items-center justify-between p-3 border-2 border-primary rounded-lg mt-4'>
                <div className='flex items-center gap-3 '>
                    <div className='bg-red-50 p-1 rounded-full w-12 h-12 overflow-hidden flex items-center justify-center border-2 border-primary'>
                        <img className='h-full w-full object-cover' src="https://images.unsplash.com/photo-1576091160-550-217359f4ecf8?q=80&w=2670&auto=format&fit=crop" alt="Patient" />
                    </div>
                    <h2 className='text-lg font-bold capitalize'>{props.ride?.patient.fullname.firstname}</h2>
                </div>
                <h5 className='text-lg font-semibold text-primary'>MISSION</h5>
            </div>
            <div className='flex gap-2 justify-between flex-col items-center'>
                <div className='w-full mt-5'>
                    <div className='flex items-center gap-5 p-3 border-b-2'>
                        <i className="ri-map-pin-user-fill text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>Pickup</h3>
                            <p className='text-sm -mt-1 text-gray-600'>{props.ride?.pickup}</p>
                        </div>
                    </div>
                    <div className='flex items-center gap-5 p-3 border-b-2'>
                        <i className="text-lg ri-map-pin-2-fill text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>Hospital</h3>
                            <p className='text-sm -mt-1 text-gray-600'>{props.ride?.destination}</p>
                        </div>
                    </div>
                    <div className='flex items-center gap-5 p-3 font-bold'>
                        <i className="ri-money-rupee-circle-line text-primary"></i>
                        <div>
                            <h3 className='text-lg font-bold'>₹{props.ride?.fare} </h3>
                            <p className='text-sm -mt-1 text-gray-600'>Trip Fare</p>
                        </div>
                    </div>
                </div>

                <div className='mt-6 w-full'>
                    <form onSubmit={submitHander}>
                        <h4 className='text-center text-sm text-gray-500 mb-2'>ASK PATIENT FOR EMERGENCY OTP</h4>
                        <input value={otp} onChange={(e) => setOtp(e.target.value)} type="text" className='bg-[#eee] px-6 py-4 font-mono text-center text-2xl tracking-widest rounded-lg w-full mt-1 border-2 border-primary' placeholder='000000' />

                        <button className='w-full mt-5 text-lg flex justify-center bg-primary text-white font-bold p-3 rounded-lg'>START MEDICAL TRIP</button>
                        <button onClick={() => {
                            props.setConfirmEmergencyPopupPanel(false)
                            props.setEmergencyPopupPanel(false)

                        }} className='w-full mt-2 bg-gray-500 text-lg text-white font-semibold p-3 rounded-lg'>CANCEL</button>

                    </form>
                </div>
            </div>
        </div>
    )
}

export default ConfirmEmergencyPopUp
