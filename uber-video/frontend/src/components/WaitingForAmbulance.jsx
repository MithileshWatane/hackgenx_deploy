import React from 'react'

const WaitingForAmbulance = (props) => {
    return (
        <div>
            <h5 className='p-1 text-center w-[93%] absolute top-0' onClick={() => {
                props.setWaitingForAmbulance(false)
            }}><i className="text-3xl text-gray-200 ri-arrow-down-wide-line"></i></h5>

            <div className='flex items-center justify-between mb-4'>
                <div className='bg-red-50 p-1 rounded-lg w-20 h-16 flex items-center justify-center overflow-hidden'>
                    <img className='h-full w-full object-cover' src="https://images.unsplash.com/photo-1542884748-2b87b36c6b90?q=80&w=2570&auto=format&fit=crop" alt="Ambulance" />
                </div>
                <div className='text-right'>
                    <h2 className='text-lg font-medium capitalize'>{props.ride?.ambulanceDriver.fullname.firstname}</h2>
                    <h4 className='text-xl font-bold -mt-1 -mb-1 text-primary'>{props.ride?.ambulanceDriver.ambulance.plate}</h4>
                    <p className='text-sm text-gray-600'>{props.ride?.ambulanceDriver.ambulance.ambulanceType} Ambulance</p>
                    <div className='bg-red-600 text-white px-3 py-1 rounded inline-block mt-1 font-bold'>OTP: {props.ride?.otp}</div>
                </div>
            </div>

            <div className='flex gap-2 justify-between flex-col items-center'>
                <div className='w-full mt-2'>
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
                            <p className='text-sm -mt-1 text-gray-600'>To be paid</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default WaitingForAmbulance
