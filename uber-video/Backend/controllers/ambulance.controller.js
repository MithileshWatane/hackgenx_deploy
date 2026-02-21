const ambulanceDriverModel = require('../models/ambulanceDriver.model');
const ambulanceService = require('../services/ambulance.service');
const blackListTokenModel = require('../models/blackListToken.model');
const { validationResult } = require('express-validator');


module.exports.registerAmbulanceDriver = async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, email, password, ambulance } = req.body;

    const isAmbulanceDriverAlreadyExist = await ambulanceDriverModel.findOne({ email });

    if (isAmbulanceDriverAlreadyExist) {
        return res.status(400).json({ message: 'Ambulance Driver already exist' });
    }


    const hashedPassword = await ambulanceDriverModel.hashPassword(password);

    const ambulanceDriver = await ambulanceService.createAmbulanceDriver({
        firstname: fullname.firstname,
        lastname: fullname.lastname,
        email,
        password: hashedPassword,
        color: ambulance.color,
        plate: ambulance.plate,
        capacity: ambulance.capacity,
        ambulanceType: ambulance.ambulanceType
    });

    const token = ambulanceDriver.generateAuthToken();

    res.status(201).json({ token, ambulanceDriver });

}

module.exports.loginAmbulanceDriver = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const ambulanceDriver = await ambulanceDriverModel.findOne({ email }).select('+password');

    if (!ambulanceDriver) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await ambulanceDriver.comparePassword(password);

    if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = ambulanceDriver.generateAuthToken();

    res.cookie('token', token);

    res.status(200).json({ token, ambulanceDriver });
}

module.exports.getAmbulanceDriverProfile = async (req, res, next) => {
    res.status(200).json({ ambulanceDriver: req.ambulanceDriver });
}

module.exports.logoutAmbulanceDriver = async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    await blackListTokenModel.create({ token });

    res.clearCookie('token');

    res.status(200).json({ message: 'Logout successfully' });
}
