const emergencyService = require('../services/emergency.service');
const { validationResult } = require('express-validator');
const mapService = require('../services/maps.service');
const { sendMessageToSocketId } = require('../socket');
const emergencyRequestModel = require('../models/emergencyRequest.model');


module.exports.createEmergencyRequest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination, ambulanceType } = req.body;

    try {
        const emergencyRequest = await emergencyService.createEmergencyRequest({ patient: req.user._id, pickup, destination, ambulanceType });
        res.status(201).json(emergencyRequest);

        const pickupCoordinates = await mapService.getAddressCoordinate(pickup);

        const ambulanceDriversInRadius = await mapService.getAmbulanceDriversInTheRadius(pickupCoordinates.ltd, pickupCoordinates.lng, 2);

        emergencyRequest.otp = ""

        const requestWithPatient = await emergencyRequestModel.findOne({ _id: emergencyRequest._id }).populate('patient');

        ambulanceDriversInRadius.map(driver => {
            sendMessageToSocketId(driver.socketId, {
                event: 'new-emergency',
                data: requestWithPatient
            })
        })

    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: err.message });
    }

};

module.exports.getFare = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination } = req.query;

    try {
        const fare = await emergencyService.getFare(pickup, destination);
        return res.status(200).json(fare);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

module.exports.confirmEmergencyRequest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { emergencyRequestId } = req.body;

    try {
        const emergencyRequest = await emergencyService.confirmEmergencyRequest({ emergencyRequestId, ambulanceDriver: req.ambulanceDriver });

        sendMessageToSocketId(emergencyRequest.patient.socketId, {
            event: 'emergency-confirmed',
            data: emergencyRequest
        })

        return res.status(200).json(emergencyRequest);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: err.message });
    }
}

module.exports.startMedicalTrip = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { emergencyRequestId, otp } = req.query;

    try {
        const emergencyRequest = await emergencyService.startMedicalTrip({ emergencyRequestId, otp, ambulanceDriver: req.ambulanceDriver });

        sendMessageToSocketId(emergencyRequest.patient.socketId, {
            event: 'emergency-started',
            data: emergencyRequest
        })

        return res.status(200).json(emergencyRequest);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

module.exports.endMedicalTrip = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { emergencyRequestId } = req.body;

    try {
        const emergencyRequest = await emergencyService.endMedicalTrip({ emergencyRequestId, ambulanceDriver: req.ambulanceDriver });

        sendMessageToSocketId(emergencyRequest.patient.socketId, {
            event: 'emergency-ended',
            data: emergencyRequest
        })

        return res.status(200).json(emergencyRequest);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}
