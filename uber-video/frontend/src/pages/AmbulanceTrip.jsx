import React, { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import FinishMedicalTrip from '../components/FinishMedicalTrip'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import LiveTracking from '../components/LiveTracking'

const AmbulanceTrip = () => {

    const [finishMissionPanel, setFinishMissionPanel] = useState(false)
    const finishMissionPanelRef = useRef(null)
    const location = useLocation()
    const rideData = location.state?.ride

    useGSAP(function () {
        if (finishMissionPanel) {
            gsap.to(finishMissionPanelRef.current, {
                transform: 'translateY(0)'
            })
        } else {
            gsap.to(finishMissionPanelRef.current, {
                transform: 'translateY(100%)'
            })
        }
    }, [finishMissionPanel])


    return (
        <div className='h-screen relative flex flex-col justify-end'>

            <div className='fixed p-6 top-0 flex items-center justify-between w-screen z-10'>
                <div className='flex items-center bg-white p-2 rounded-lg shadow-md'>
                    <i className="ri-hospital-line text-2xl text-primary font-bold"></i>
                    <span className='text-xl font-bold ml-2 text-primary'>Ambulance</span>
                </div>
                <Link to='/ambulance-home' className=' h-10 w-10 bg-white flex items-center justify-center rounded-full shadow-md'>
                    <i className="text-xl font-bold text-primary ri-logout-box-r-line"></i>
                </Link>
            </div>

            <div className='h-1/5 p-6 flex items-center justify-between relative bg-primary text-white pt-10 rounded-t-3xl shadow-t-2xl'
                onClick={() => {
                    setFinishMissionPanel(true)
                }}
            >
                <h5 className='p-1 text-center w-[90%] absolute top-0'><i className="text-3xl text-white opacity-50 ri-arrow-up-wide-line"></i></h5>
                <div className='flex flex-col'>
                    <h4 className='text-xl font-bold'>EN ROUTE</h4>
                    <p className='text-sm opacity-80'>To Hospital</p>
                </div>
                <button className=' bg-white text-primary font-bold p-3 px-10 rounded-lg'>COMPLETE MISSION</button>
            </div>
            <div ref={finishMissionPanelRef} className='fixed w-full z-[500] bottom-0 translate-y-full bg-white px-3 py-10 pt-12 rounded-t-3xl shadow-2xl'>
                <FinishMedicalTrip
                    ride={rideData}
                    setFinishMissionPanel={setFinishMissionPanel} />
            </div>

            <div className='h-screen fixed w-screen top-0 z-[-1]'>
                <LiveTracking />
            </div>

        </div>
    )
}

export default AmbulanceTrip
