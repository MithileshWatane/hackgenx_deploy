import React from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'


const FinishMedicalTrip = (props) => {

    const navigate = useNavigate()

    async function endRide() {
        const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/emergencies/end-trip`, {
            emergencyRequestId: props.ride._id
        }, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        })

        if (response.status === 200) {
            navigate('/ambulance-home')
        }

    }

    return (
        <div>
            <h5 className='p-1 text-center w-[93%] absolute top-0' onClick={() => {
                props.setFinishMissionPanel(false)
            }}><i className="text-3xl text-gray-200 ri-arrow-down-wide-line"></i></h5>
            <h3 className='text-2xl font-bold mb-5 text-primary text-center'>Mission Completed?</h3>
            <div className='flex items-center justify-between p-4 border-2 border-primary rounded-lg mt-4'>
                <div className='flex items-center gap-3 '>
                    <div className='bg-red-50 p-1 rounded-full w-12 h-12 overflow-hidden flex items-center justify-center border-2 border-primary'>
                        <img className='h-full w-full object-cover' src="https://images.unsplash.com/photo-1519494140681-89162043a2bc?q=80&w=2670&auto=format&fit=crop" alt="Hospital Arrival" />
                    </div>
                    <h2 className='text-lg font-bold'>{props.ride?.patient.fullname.firstname}</h2>
                </div>
                <h5 className='text-lg font-bold text-primary'>FEE: ₹{props.ride?.fare}</h5>
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
                            <h3 className='text-lg font-medium'>Hospital (Dropped)</h3>
                            <p className='text-sm -mt-1 text-gray-600'>{props.ride?.destination}</p>
                        </div>
                    </div>
                </div>

                <div className='mt-10 w-full'>
                    <button
                        onClick={endRide}
                        className='w-full mt-5 flex text-lg justify-center bg-primary text-white font-bold p-3 rounded-lg'>FINISH EMERGENCY MISSION</button>
                </div>
            </div>
        </div>
    )
}

export default FinishMedicalTrip;
