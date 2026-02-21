import React, { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import axios from 'axios';
import 'remixicon/fonts/remixicon.css'
import LocationSearchPanel from '../components/LocationSearchPanel';
import AmbulanceTypePanel from '../components/AmbulanceTypePanel';
import ConfirmBooking from '../components/ConfirmBooking';
import LookingForAmbulance from '../components/LookingForAmbulance';
import WaitingForAmbulance from '../components/WaitingForAmbulance';
import { SocketContext } from '../context/SocketContext';
import { useContext } from 'react';
import { PatientDataContext } from '../context/PatientContext';
import { useNavigate } from 'react-router-dom';
import LiveTracking from '../components/LiveTracking';

const PatientHome = () => {
    const [pickup, setPickup] = useState('')
    const [destination, setDestination] = useState('')
    const [panelOpen, setPanelOpen] = useState(false)
    const ambulanceTypePanelRef = useRef(null)
    const confirmBookingPanelRef = useRef(null)
    const searchingAmbulanceRef = useRef(null)
    const waitingForAmbulanceRef = useRef(null)
    const panelRef = useRef(null)
    const panelCloseRef = useRef(null)
    const [ambulanceTypePanel, setAmbulanceTypePanel] = useState(false)
    const [confirmBookingPanel, setConfirmBookingPanel] = useState(false)
    const [searchingAmbulance, setSearchingAmbulance] = useState(false)
    const [waitingForAmbulance, setWaitingForAmbulance] = useState(false)
    const [pickupSuggestions, setPickupSuggestions] = useState([])
    const [destinationSuggestions, setDestinationSuggestions] = useState([])
    const [activeField, setActiveField] = useState(null)
    const [fare, setFare] = useState({})
    const [ambulanceType, setAmbulanceType] = useState(null)
    const [ride, setRide] = useState(null)

    const navigate = useNavigate()

    const { socket } = useContext(SocketContext)
    const { patient } = useContext(PatientDataContext)

    useEffect(() => {
        socket.emit("join", { userType: "patient", userId: patient._id })
    }, [patient])

    socket.on('emergency-confirmed', ride => {
        setSearchingAmbulance(false)
        setWaitingForAmbulance(true)
        setRide(ride)
    })

    socket.on('emergency-started', ride => {
        setWaitingForAmbulance(false)
        navigate('/medical-trip', { state: { ride } })
    })


    const handlePickupChange = async (e) => {
        setPickup(e.target.value)
        try {
            const response = await axios.get(`${import.meta.env.VITE_BASE_URL}/maps/get-suggestions`, {
                params: { input: e.target.value },
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }

            })
            setPickupSuggestions(response.data)
        } catch {
            // handle error
        }
    }

    const handleDestinationChange = async (e) => {
        setDestination(e.target.value)
        try {
            const response = await axios.get(`${import.meta.env.VITE_BASE_URL}/maps/get-suggestions`, {
                params: { input: e.target.value },
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }
            })
            setDestinationSuggestions(response.data)
        } catch {
            // handle error
        }
    }

    const submitHandler = (e) => {
        e.preventDefault()
    }

    useGSAP(function () {
        if (panelOpen) {
            gsap.to(panelRef.current, {
                height: '70%',
                padding: 24
            })
            gsap.to(panelCloseRef.current, {
                opacity: 1
            })
        } else {
            gsap.to(panelRef.current, {
                height: '0%',
                padding: 0
            })
            gsap.to(panelCloseRef.current, {
                opacity: 0
            })
        }
    }, [panelOpen])


    useGSAP(function () {
        if (ambulanceTypePanel) {
            gsap.to(ambulanceTypePanelRef.current, {
                transform: 'translateY(0)'
            })
        } else {
            gsap.to(ambulanceTypePanelRef.current, {
                transform: 'translateY(100%)'
            })
        }
    }, [ambulanceTypePanel])

    useGSAP(function () {
        if (confirmBookingPanel) {
            gsap.to(confirmBookingPanelRef.current, {
                transform: 'translateY(0)'
            })
        } else {
            gsap.to(confirmBookingPanelRef.current, {
                transform: 'translateY(100%)'
            })
        }
    }, [confirmBookingPanel])

    useGSAP(function () {
        if (searchingAmbulance) {
            gsap.to(searchingAmbulanceRef.current, {
                transform: 'translateY(0)'
            })
        } else {
            gsap.to(searchingAmbulanceRef.current, {
                transform: 'translateY(100%)'
            })
        }
    }, [searchingAmbulance])

    useGSAP(function () {
        if (waitingForAmbulance) {
            gsap.to(waitingForAmbulanceRef.current, {
                transform: 'translateY(0)'
            })
        } else {
            gsap.to(waitingForAmbulanceRef.current, {
                transform: 'translateY(100%)'
            })
        }
    }, [waitingForAmbulance])


    async function findTrip() {
        setAmbulanceTypePanel(true)
        setPanelOpen(false)

        const response = await axios.get(`${import.meta.env.VITE_BASE_URL}/emergencies/get-fare`, {
            params: { pickup, destination },
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        })


        setFare(response.data)


    }

    async function createEmergency() {
        const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/emergencies/create`, {
            pickup,
            destination,
            ambulanceType: ambulanceType
        }, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        })


    }

    return (
        <div className='h-screen relative overflow-hidden'>
            <div className='absolute left-5 top-5 z-10 flex items-center bg-white p-2 rounded-lg shadow-md'>
                <i className="ri-hospital-line text-2xl text-primary font-bold"></i>
                <span className='text-xl font-bold ml-2 text-primary'>Ambulance</span>
            </div>
            <div className='h-screen w-screen'>
                <LiveTracking />
            </div>
            <div className=' flex flex-col justify-end h-screen absolute top-0 w-full'>
                <div className='h-[30%] p-6 bg-white relative'>
                    <h5 ref={panelCloseRef} onClick={() => {
                        setPanelOpen(false)
                    }} className='absolute opacity-0 right-6 top-6 text-2xl'>
                        <i className="ri-arrow-down-wide-line"></i>
                    </h5>
                    <h4 className='text-2xl font-bold text-primary'>Book Emergency Ambulance</h4>
                    <form className='relative py-3' onSubmit={(e) => {
                        submitHandler(e)
                    }}>
                        <div className="line absolute h-16 w-1 top-[50%] -translate-y-1/2 left-5 bg-primary rounded-full"></div>
                        <input
                            onClick={() => {
                                setPanelOpen(true)
                                setActiveField('pickup')
                            }}
                            value={pickup}
                            onChange={handlePickupChange}
                            className='bg-[#eee] px-12 py-2 text-lg rounded-lg w-full border-2 focus:border-primary outline-none'
                            type="text"
                            placeholder='Patient pickup location'
                        />
                        <input
                            onClick={() => {
                                setPanelOpen(true)
                                setActiveField('destination')
                            }}
                            value={destination}
                            onChange={handleDestinationChange}
                            className='bg-[#eee] px-12 py-2 text-lg rounded-lg w-full mt-3 border-2 focus:border-primary outline-none'
                            type="text"
                            placeholder='Hospital destination' />
                    </form>
                    <button
                        onClick={findTrip}
                        className='bg-primary text-white px-4 py-3 rounded-lg mt-3 w-full font-bold text-lg'>
                        Check Availability
                    </button>
                </div>
                <div ref={panelRef} className='bg-white h-0'>
                    <LocationSearchPanel
                        suggestions={activeField === 'pickup' ? pickupSuggestions : destinationSuggestions}
                        setPanelOpen={setPanelOpen}
                        setAmbulanceTypePanel={setAmbulanceTypePanel}
                        setPickup={setPickup}
                        setDestination={setDestination}
                        activeField={activeField}
                    />
                </div>
            </div>
            <div ref={ambulanceTypePanelRef} className='fixed w-full z-10 bottom-0 translate-y-full bg-white px-3 py-10 pt-12 rounded-t-3xl shadow-2xl'>
                <AmbulanceTypePanel
                    selectAmbulance={setAmbulanceType}
                    fare={fare}
                    setConfirmBookingPanel={setConfirmBookingPanel}
                    setAmbulanceTypePanel={setAmbulanceTypePanel} />
            </div>
            <div ref={confirmBookingPanelRef} className='fixed w-full z-10 bottom-0 translate-y-full bg-white px-3 py-6 pt-12 rounded-t-3xl shadow-2xl'>
                <ConfirmBooking
                    createEmergency={createEmergency}
                    pickup={pickup}
                    destination={destination}
                    fare={fare}
                    ambulanceType={ambulanceType}
                    setConfirmBookingPanel={setConfirmBookingPanel}
                    setSearchingAmbulance={setSearchingAmbulance} />
            </div>
            <div ref={searchingAmbulanceRef} className='fixed w-full z-10 bottom-0 translate-y-full bg-white px-3 py-6 pt-12 rounded-t-3xl shadow-2xl'>
                <LookingForAmbulance
                    createEmergency={createEmergency}
                    pickup={pickup}
                    destination={destination}
                    fare={fare}
                    ambulanceType={ambulanceType}
                    setSearchingAmbulance={setSearchingAmbulance} />
            </div>
            <div ref={waitingForAmbulanceRef} className='fixed w-full  z-10 bottom-0  bg-white px-3 py-6 pt-12 rounded-t-3xl shadow-2xl'>
                <WaitingForAmbulance
                    ride={ride}
                    setSearchingAmbulance={setSearchingAmbulance}
                    setWaitingForAmbulance={setWaitingForAmbulance}
                    waitingForAmbulance={waitingForAmbulance} />
            </div>
        </div>
    )
}

export default PatientHome
