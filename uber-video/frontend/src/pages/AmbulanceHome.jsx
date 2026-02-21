import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AmbulanceDriverDetails from '../components/AmbulanceDriverDetails'
import EmergencyRequestPopUp from '../components/EmergencyPopUp'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import ConfirmEmergencyPopUp from '../components/ConfirmEmergencyPopUp'
import { useEffect, useContext } from 'react'
import { SocketContext } from '../context/SocketContext'
import { AmbulanceDataContext } from '../context/AmbulanceContext'
import axios from 'axios'

const AmbulanceHome = () => {

    const [emergencyPopupPanel, setEmergencyPopupPanel] = useState(false)
    const [confirmEmergencyPopupPanel, setConfirmEmergencyPopupPanel] = useState(false)

    const emergencyPopupPanelRef = useRef(null)
    const confirmEmergencyPopupPanelRef = useRef(null)
    const [ride, setRide] = useState(null)

    const { socket } = useContext(SocketContext)
    const { ambulanceDriver } = useContext(AmbulanceDataContext)

    useEffect(() => {
        socket.emit('join', {
            userId: ambulanceDriver._id,
            userType: 'ambulance-driver'
        })
        const updateLocation = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(position => {

                    socket.emit('update-location-ambulance', {
                        userId: ambulanceDriver._id,
                        location: {
                            ltd: position.coords.latitude,
                            lng: position.coords.longitude
                        }
                    })
                })
            }
        }

        const locationInterval = setInterval(updateLocation, 10000)
        updateLocation()

        return () => clearInterval(locationInterval)
    }, [])

    socket.on('new-emergency', (data) => {
        setRide(data)
        setEmergencyPopupPanel(true)
    })

    async function confirmEmergency() {
        const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/emergencies/confirm`, {
            emergencyRequestId: ride._id,
            ambulanceDriverId: ambulanceDriver._id,
        }, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        })

        setEmergencyPopupPanel(false)
        setConfirmEmergencyPopupPanel(true)
    }


    useGSAP(function () {
        if (emergencyPopupPanel) {
            gsap.to(emergencyPopupPanelRef.current, {
                transform: 'translateY(0)'
            })
        } else {
            gsap.to(emergencyPopupPanelRef.current, {
                transform: 'translateY(100%)'
            })
        }
    }, [emergencyPopupPanel])

    useGSAP(function () {
        if (confirmEmergencyPopupPanel) {
            gsap.to(confirmEmergencyPopupPanelRef.current, {
                transform: 'translateY(0)'
            })
        } else {
            gsap.to(confirmEmergencyPopupPanelRef.current, {
                transform: 'translateY(100%)'
            })
        }
    }, [confirmEmergencyPopupPanel])

    return (
        <div className='h-screen'>
            <div className='fixed p-6 top-0 flex items-center justify-between w-screen z-10'>
                <div className='flex items-center bg-white p-2 rounded-lg shadow-md'>
                    <i className="ri-hospital-line text-2xl text-primary font-bold"></i>
                    <span className='text-xl font-bold ml-2 text-primary'>Ambulance</span>
                </div>
                <Link to='/ambulance/logout' className=' h-10 w-10 bg-white flex items-center justify-center rounded-full shadow-md'>
                    <i className="text-xl font-bold text-primary ri-logout-box-r-line"></i>
                </Link>
            </div>
            <div className='h-3/5'>
                <img className='h-full w-full object-cover' src="https://images.unsplash.com/photo-1612942458064-006263447999?q=80&w=2574&auto=format&fit=crop" alt="Emergency Ambulance" />
            </div>
            <div className='h-2/5 p-6 bg-white rounded-t-3xl -mt-8 relative z-10 shadow-t-xl'>
                <AmbulanceDriverDetails />
            </div>
            <div ref={emergencyPopupPanelRef} className='fixed w-full z-20 bottom-0 translate-y-full bg-white px-3 py-10 pt-12 rounded-t-3xl shadow-2xl'>
                <EmergencyRequestPopUp
                    ride={ride}
                    setEmergencyPopupPanel={setEmergencyPopupPanel}
                    setConfirmEmergencyPopupPanel={setConfirmEmergencyPopupPanel}
                    confirmEmergency={confirmEmergency}
                />
            </div>
            <div ref={confirmEmergencyPopupPanelRef} className='fixed w-full h-screen z-20 bottom-0 translate-y-full bg-white px-3 py-10 pt-12 rounded-t-3xl shadow-2xl'>
                <ConfirmEmergencyPopUp
                    ride={ride}
                    setConfirmEmergencyPopupPanel={setConfirmEmergencyPopupPanel} setEmergencyPopupPanel={setEmergencyPopupPanel} />
            </div>
        </div>
    )
}

export default AmbulanceHome
