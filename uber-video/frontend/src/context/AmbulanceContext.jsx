import { createContext, useState, useContext } from 'react';

export const AmbulanceDataContext = createContext();

const AmbulanceContext = ({ children }) => {
    const [ambulanceDriver, setAmbulanceDriver] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const updateAmbulanceDriver = (driverData) => {
        setAmbulanceDriver(driverData);
    };

    const value = {
        ambulanceDriver,
        setAmbulanceDriver,
        isLoading,
        setIsLoading,
        error,
        setError,
        updateAmbulanceDriver
    };

    return (
        <AmbulanceDataContext.Provider value={value}>
            {children}
        </AmbulanceDataContext.Provider>
    );
};

export default AmbulanceContext;
