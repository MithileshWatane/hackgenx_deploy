import React from 'react'

const ConfirmBooking = (props) => {
    return (
        <div>
            <h5 className='p-1 text-center w-[93%] absolute top-0' onClick={() => {
                props.setConfirmBookingPanel(false)
            }}><i className="text-3xl text-gray-200 ri-arrow-down-wide-line"></i></h5>
            <h3 className='text-2xl font-semibold mb-5'>Confirm Emergency Booking</h3>

            <div className='flex gap-2 justify-between flex-col items-center'>
                <div className='bg-red-50 p-1 rounded-2xl mb-4 w-full h-40 flex items-center justify-center overflow-hidden'>
                    <img className='w-full h-full object-cover' src="https://images.unsplash.com/photo-1626244795304-4861298811dc?q=80&w=2670&auto=format&fit=crop" alt="Emergency Ambulance" />
                </div>
                <div className='w-full mt-2'>
                    <div className='flex items-center gap-5 p-3 border-b-2'>
                        <i className="ri-map-pin-user-fill text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>Current Patient Location</h3>
                            <p className='text-sm -mt-1 text-gray-600'>{props.pickup}</p>
                        </div>
                    </div>
                    <div className='flex items-center gap-5 p-3 border-b-2'>
                        <i className="text-lg ri-map-pin-2-fill text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>Destination Hospital</h3>
                            <p className='text-sm -mt-1 text-gray-600'>{props.destination}</p>
                        </div>
                    </div>
                    <div className='flex items-center gap-5 p-3'>
                        <i className="ri-money-rupee-circle-line text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>₹{props.fare[props.ambulanceType]}</h3>
                            <p className='text-sm -mt-1 text-gray-600'>Estimated Fare ({props.ambulanceType})</p>
                        </div>
                    </div>
                </div>
                <button onClick={() => {
                    props.setSearchingAmbulance(true)
                    props.setConfirmBookingPanel(false)
                    props.createEmergency()

                }} className='w-full mt-5 bg-primary text-white font-bold p-3 rounded-lg text-lg'>Request Emergency Ambulance</button>
            </div>
        </div>
    )
}

export default ConfirmBooking
