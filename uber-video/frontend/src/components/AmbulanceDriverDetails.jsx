import React, { useContext } from 'react'
import { AmbulanceDataContext } from '../context/AmbulanceContext'

const AmbulanceDriverDetails = () => {

    const { ambulanceDriver } = useContext(AmbulanceDataContext)

    return (
        <div>
            <div className='flex items-center justify-between'>
                <div className='flex items-center justify-start gap-3'>
                    <img className='h-12 w-12 rounded-full object-cover border-2 border-primary shadow-sm' src="https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80&w=2570&auto=format&fit=crop" alt="Ambulance Driver" />
                    <h4 className='text-lg font-medium capitalize text-primary font-bold'>{ambulanceDriver.fullname.firstname + " " + ambulanceDriver.fullname.lastname}</h4>
                </div>
                <div>
                    <h4 className='text-xl font-bold text-primary'>₹295.20</h4>
                    <p className='text-sm text-gray-600 font-semibold'>Earned Today</p>
                </div>
            </div>
            <div className='flex p-3 mt-8 bg-red-50 rounded-xl justify-center gap-5 items-start'>
                <div className='text-center'>
                    <i className="text-3xl mb-2 font-thin ri-timer-2-line text-primary"></i>
                    <h5 className='text-lg font-medium'>10.2</h5>
                    <p className='text-sm text-gray-600'>Hours Online</p>
                </div>
                <div className='text-center'>
                    <i className="text-3xl mb-2 font-thin ri-speed-up-line text-primary"></i>
                    <h5 className='text-lg font-medium'>10.2</h5>
                    <p className='text-sm text-gray-600'>Trips Completed</p>
                </div>
                <div className='text-center'>
                    <i className="text-3xl mb-2 font-thin ri-booklet-line text-primary"></i>
                    <h5 className='text-lg font-medium'>10.2</h5>
                    <p className='text-sm text-gray-600'>Total Missions</p>
                </div>

            </div>
        </div>
    )
}

export default AmbulanceDriverDetails
