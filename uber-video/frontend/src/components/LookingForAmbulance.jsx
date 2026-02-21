import React from 'react'

const LookingForAmbulance = (props) => {
    return (
        <div>
            <h5 className='p-1 text-center w-[93%] absolute top-0' onClick={() => {
                props.setSearchingAmbulance(false)
            }}><i className="text-3xl text-gray-200 ri-arrow-down-wide-line"></i></h5>
            <h3 className='text-2xl font-semibold mb-5'>Finding Nearest Ambulance...</h3>

            <div className='flex gap-2 justify-between flex-col items-center'>
                <div className='relative w-full flex justify-center py-4 h-40 overflow-hidden rounded-2xl'>
                    <div className='absolute inset-0 flex items-center justify-center z-20'>
                        <div className='animate-ping absolute h-32 w-32 rounded-full bg-red-100 opacity-75'></div>
                    </div>
                    <img className='w-full h-full object-cover relative z-10 rounded-2xl shadow-md' src="https://images.unsplash.com/photo-1612942458064-006263447999?q=80&w=2574&auto=format&fit=crop" alt="Searching Ambulance" />
                </div>
                <div className='w-full mt-5'>
                    <div className='flex items-center gap-5 p-3 border-b-2'>
                        <i className="ri-map-pin-user-fill text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>Patient Location</h3>
                            <p className='text-sm -mt-1 text-gray-600'>{props.pickup}</p>
                        </div>
                    </div>
                    <div className='flex items-center gap-5 p-3 border-b-2'>
                        <i className="text-lg ri-map-pin-2-fill text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>Destination</h3>
                            <p className='text-sm -mt-1 text-gray-600'>{props.destination}</p>
                        </div>
                    </div>
                    <div className='flex items-center gap-5 p-3'>
                        <i className="ri-money-rupee-circle-line text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>₹{props.fare[props.ambulanceType]} </h3>
                            <p className='text-sm -mt-1 text-gray-600'>Estimated Fare</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LookingForAmbulance
