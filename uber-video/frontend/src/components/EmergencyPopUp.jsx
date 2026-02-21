import React from 'react'

const EmergencyPopUp = (props) => {
    return (
        <div>
            <h5 className='p-1 text-center w-[93%] absolute top-0' onClick={() => {
                props.setEmergencyPopupPanel(false)
            }}><i className="text-3xl text-gray-200 ri-arrow-down-wide-line"></i></h5>
            <h3 className='text-2xl font-bold mb-5 text-primary'>New Emergency Request!</h3>
            <div className='flex items-center justify-between p-3 bg-primary text-white rounded-lg mt-4'>
                <div className='flex items-center gap-3 '>
                    <div className='bg-white p-1 rounded-full w-12 h-12 overflow-hidden flex items-center justify-center border-2 border-primary'>
                        <img className='h-full w-full object-cover' src="https://images.unsplash.com/photo-1576091160550-217359f4ecf8?q=80&w=2670&auto=format&fit=crop" alt="Patient" />
                    </div>
                    <h2 className='text-lg font-bold'>{props.ride?.patient.fullname.firstname + " " + props.ride?.patient.fullname.lastname}</h2>
                </div>
                <h5 className='text-lg font-semibold'>2.2 KM AWAY</h5>
            </div>
            <div className='flex gap-2 justify-between flex-col items-center'>
                <div className='w-full mt-5'>
                    <div className='flex items-center gap-5 p-3 border-b-2'>
                        <i className="ri-map-pin-user-fill text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>Patient Location</h3>
                            <p className='text-sm -mt-1 text-gray-600'>{props.ride?.pickup}</p>
                        </div>
                    </div>
                    <div className='flex items-center gap-5 p-3 border-b-2'>
                        <i className="text-lg ri-map-pin-2-fill text-primary"></i>
                        <div>
                            <h3 className='text-lg font-medium'>Destination Hospital</h3>
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
                <div className='mt-5 w-full '>
                    <button onClick={() => {
                        props.setConfirmEmergencyPopupPanel(true)
                        props.confirmEmergency()

                    }} className=' bg-green-600 w-full text-white font-bold p-3 px-10 rounded-lg text-lg'>ACCEPT MISSION</button>

                    <button onClick={() => {
                        props.setEmergencyPopupPanel(false)

                    }} className='mt-2 w-full bg-gray-300 text-gray-700 font-semibold p-3 px-10 rounded-lg'>IGNORE</button>


                </div>
            </div>
        </div>
    )
}

export default EmergencyPopUp
