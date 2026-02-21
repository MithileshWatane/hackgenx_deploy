const emergencyRequestModel = require('../models/emergencyRequest.model');
const mapService = require('./maps.service');
const crypto = require('crypto');

async function getFare(pickup, destination) {

    if (!pickup || !destination) {
        throw new Error('Pickup and destination are required');
    }

    const distanceTime = await mapService.getDistanceTime(pickup, destination);

    const baseFare = {
        Basic: 200,
        ICU: 500,
        Ventilator: 1000
    };

    const perKmRate = {
        Basic: 20,
        ICU: 30,
        Ventilator: 50
    };

    const perMinuteRate = {
        Basic: 5,
        ICU: 10,
        Ventilator: 15
    };

    const fare = {
        Basic: Math.round(baseFare.Basic + ((distanceTime.distance.value / 1000) * perKmRate.Basic) + ((distanceTime.duration.value / 60) * perMinuteRate.Basic)),
        ICU: Math.round(baseFare.ICU + ((distanceTime.distance.value / 1000) * perKmRate.ICU) + ((distanceTime.duration.value / 60) * perMinuteRate.ICU)),
        Ventilator: Math.round(baseFare.Ventilator + ((distanceTime.distance.value / 1000) * perKmRate.Ventilator) + ((distanceTime.duration.value / 60) * perMinuteRate.Ventilator))
    };

    return fare;
}

module.exports.getFare = getFare;

function getOtp(num) {
    function generateOtp(num) {
        const otp = crypto.randomInt(Math.pow(10, num - 1), Math.pow(10, num)).toString();
        return otp;
    }
    return generateOtp(num);
}


module.exports.createEmergencyRequest = async ({
    patient, pickup, destination, ambulanceType
}) => {
    if (!patient || !pickup || !destination || !ambulanceType) {
        throw new Error('All fields are required');
    }

    const fare = await getFare(pickup, destination);

    const emergencyRequest = emergencyRequestModel.create({
        patient,
        pickup,
        destination,
        otp: getOtp(6),
        fare: fare[ambulanceType]
    })

    return emergencyRequest;
}

module.exports.confirmEmergencyRequest = async ({
    emergencyRequestId, ambulanceDriver
}) => {
    if (!emergencyRequestId) {
        throw new Error('Emergency request id is required');
    }

    await emergencyRequestModel.findOneAndUpdate({
        _id: emergencyRequestId
    }, {
        status: 'accepted',
        ambulanceDriver: ambulanceDriver._id
    })

    const emergencyRequest = await emergencyRequestModel.findOne({
        _id: emergencyRequestId
    }).populate('patient').populate('ambulanceDriver').select('+otp');

    if (!emergencyRequest) {
        throw new Error('Emergency request not found');
    }

    return emergencyRequest;

}

module.exports.startMedicalTrip = async ({ emergencyRequestId, otp, ambulanceDriver }) => {
    if (!emergencyRequestId || !otp) {
        throw new Error('Emergency request id and OTP are required');
    }

    const emergencyRequest = await emergencyRequestModel.findOne({
        _id: emergencyRequestId
    }).populate('patient').populate('ambulanceDriver').select('+otp');

    if (!emergencyRequest) {
        throw new Error('Emergency request not found');
    }

    if (emergencyRequest.status !== 'accepted') {
        throw new Error('Emergency request not accepted');
    }

    if (emergencyRequest.otp !== otp) {
        throw new Error('Invalid OTP');
    }

    await emergencyRequestModel.findOneAndUpdate({
        _id: emergencyRequestId
    }, {
        status: 'ongoing'
    })

    return emergencyRequest;
}

module.exports.endMedicalTrip = async ({ emergencyRequestId, ambulanceDriver }) => {
    if (!emergencyRequestId) {
        throw new Error('Emergency request id is required');
    }

    const emergencyRequest = await emergencyRequestModel.findOne({
        _id: emergencyRequestId,
        ambulanceDriver: ambulanceDriver._id
    }).populate('patient').populate('ambulanceDriver').select('+otp');

    if (!emergencyRequest) {
        throw new Error('Emergency request not found');
    }

    if (emergencyRequest.status !== 'ongoing') {
        throw new Error('Emergency trip not ongoing');
    }

    await emergencyRequestModel.findOneAndUpdate({
        _id: emergencyRequestId
    }, {
        status: 'completed'
    })

    return emergencyRequest;
}
