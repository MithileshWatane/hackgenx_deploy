import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useContext } from 'react'
import { SocketContext } from '../context/SocketContext'
import { useNavigate } from 'react-router-dom'
import LiveTracking from '../components/LiveTracking'

const MedicalTrip = () => {
    const location = useLocation()
    const { ride } = location.state || {}
    const { socket } = useContext(SocketContext)
    const navigate = useNavigate()

    socket.on("emergency-ended", () => {
        navigate('/home')
    })


    return (
        <div className='h-screen'>
            <Link to='/home' className='fixed right-2 top-2 h-10 w-10 bg-white flex items-center justify-center rounded-full shadow-md z-10'>
                <i className="text-xl font-bold text-primary ri-home-5-line"></i>
            </Link>
            <div className='h-1/2'>
                <LiveTracking />

            </div>
            <div className='h-1/2 p-4 bg-white rounded-t-3xl -mt-8 relative z-10 shadow-t-xl'>
                <div className='flex items-center justify-between'>
                    <div className='bg-red-50 p-1 rounded-lg w-20 h-16 flex items-center justify-center overflow-hidden'>
                        <img className='h-full w-full object-cover' src="https://images.unsplash.com/photo-1542884748-2b87b36c6b90?q=80&w=2570&auto=format&fit=crop" alt="Ambulance" />
                    </div>
                    <div className='text-right'>
                        <h2 className='text-lg font-bold capitalize text-primary'>{ride?.ambulanceDriver.fullname.firstname}</h2>
                        <h4 className='text-xl font-bold -mt-1 -mb-1'>{ride?.ambulanceDriver.ambulance.plate}</h4>
                        <p className='text-sm text-gray-600 font-semibold'>{ride?.ambulanceDriver.ambulance.ambulanceType} Ambulance</p>

                    </div>
                </div>

                <div className='flex gap-2 justify-between flex-col items-center'>
                    <div className='w-full mt-5'>

                        <div className='flex items-center gap-5 p-3 border-b-2'>
                            <i className="text-xl ri-hospital-line text-primary"></i>
                            <div>
                                <h3 className='text-lg font-bold'>Destination Hospital</h3>
                                <p className='text-sm -mt-1 text-gray-600'>{ride?.destination}</p>
                            </div>
                        </div>
                        <div className='flex items-center gap-5 p-3 font-bold'>
                            <i className="ri-money-rupee-circle-line text-primary text-xl"></i>
                            <div>
                                <h3 className='text-lg font-bold'>₹{ride?.fare} </h3>
                                <p className='text-sm -mt-1 text-gray-600'>Pay on Arrival</p>
                            </div>
                        </div>
                    </div>
                </div>
                <button className='w-full mt-5 bg-primary text-white font-bold p-3 rounded-lg text-lg'>Emergency Trip in Progress</button>
            </div>
        </div>
    )
}

export default MedicalTrip
