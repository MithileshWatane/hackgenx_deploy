import React, { useContext, useEffect, useState } from 'react'
import { AmbulanceDataContext } from '../context/AmbulanceContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const AmbulanceProtectWrapper = ({
    children
}) => {

    const token = localStorage.getItem('token')
    const navigate = useNavigate()
    const { ambulanceDriver, setAmbulanceDriver } = useContext(AmbulanceDataContext)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!token) {
            navigate('/ambulance-login')
        }

        axios.get(`${import.meta.env.VITE_BASE_URL}/ambulance-drivers/profile`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }).then(response => {
            if (response.status === 200) {
                setAmbulanceDriver(response.data.ambulanceDriver)
                setIsLoading(false)
            }
        })
            .catch(err => {
                localStorage.removeItem('token')
                navigate('/ambulance-login')
            })
    }, [token])

    if (isLoading) {
        return (
            <div>Loading...</div>
        )
    }

    return (
        <>
            {children}
        </>
    )
}

export default AmbulanceProtectWrapper
