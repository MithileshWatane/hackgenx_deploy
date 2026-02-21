import React from 'react'

const AmbulanceTypePanel = (props) => {
    return (
        <div>
            <h5 className='p-1 text-center w-[93%] absolute top-0' onClick={() => {
                props.setAmbulanceTypePanel(false)
            }}><i className="text-3xl text-gray-200 ri-arrow-down-wide-line"></i></h5>
            <h3 className='text-2xl font-semibold mb-5'>Select Ambulance Type</h3>

            <div onClick={() => {
                props.setConfirmBookingPanel(true)
                props.selectAmbulance('Basic')
            }} className='flex border-2 active:border-primary mb-2 rounded-xl w-full p-3 items-center justify-between'>
                <div className='bg-red-50 p-1 rounded-lg w-20 h-14 flex items-center justify-center overflow-hidden'>
                    <img className='h-full w-full object-cover' src="https://images.unsplash.com/photo-1542884748-2b87b36c6b90?q=80&w=2570&auto=format&fit=crop" alt="Basic" />
                </div>
                <div className='ml-2 w-1/2'>
                    <h4 className='font-medium text-base'>Basic Life Support</h4>
                    <h5 className='font-medium text-sm'>2 mins away </h5>
                    <p className='font-normal text-xs text-gray-600'>For non-critical medical transport</p>
                </div>
                <h2 className='text-lg font-semibold'>₹{props.fare.Basic}</h2>
            </div>

            <div onClick={() => {
                props.setConfirmBookingPanel(true)
                props.selectAmbulance('ICU')
            }} className='flex border-2 active:border-primary mb-2 rounded-xl w-full p-3 items-center justify-between'>
                <div className='bg-red-50 p-1 rounded-lg w-20 h-14 flex items-center justify-center overflow-hidden'>
                    <img className='h-full w-full object-cover' src="https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=2670&auto=format&fit=crop" alt="ICU" />
                </div>
                <div className='ml-2 w-1/2'>
                    <h4 className='font-medium text-base'>ICU Ambulance</h4>
                    <h5 className='font-medium text-sm'>5 mins away </h5>
                    <p className='font-normal text-xs text-gray-600'>Advanced support with monitors</p>
                </div>
                <h2 className='text-lg font-semibold'>₹{props.fare.ICU}</h2>
            </div>

            <div onClick={() => {
                props.setConfirmBookingPanel(true)
                props.selectAmbulance('Ventilator')
            }} className='flex border-2 active:border-primary mb-2 rounded-xl w-full p-3 items-center justify-between'>
                <div className='bg-red-50 p-1 rounded-lg w-20 h-14 flex items-center justify-center overflow-hidden'>
                    <img className='h-full w-full object-cover' src="https://images.unsplash.com/photo-1587744356975-4521033486cc?q=80&w=2670&auto=format&fit=crop" alt="Ventilator" />
                </div>
                <div className='ml-2 w-1/2'>
                    <h4 className='font-medium text-base'>Ventilator Support</h4>
                    <h5 className='font-medium text-sm'>8 mins away </h5>
                    <p className='font-normal text-xs text-gray-600'>Critical care with ventilation</p>
                </div>
                <h2 className='text-lg font-semibold'>₹{props.fare.Ventilator}</h2>
            </div>
        </div>
    )
}

export default AmbulanceTypePanel
