const patientModel = require('../models/patient.model');
const patientService = require('../services/patient.service');
const { validationResult } = require('express-validator');
const blackListTokenModel = require('../models/blackListToken.model');

module.exports.registerPatient = async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Registration Validation Errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, email, password } = req.body;

    const isPatientAlready = await patientModel.findOne({ email });

    if (isPatientAlready) {
        console.log('Patient already exists:', email);
        return res.status(400).json({ message: 'Patient already exist' });
    }

    const hashedPassword = await patientModel.hashPassword(password);

    const patient = await patientService.createPatient({
        firstname: fullname.firstname,
        lastname: fullname.lastname,
        email,
        password: hashedPassword
    });

    const token = patient.generateAuthToken();

    res.status(201).json({ token, patient });


}

module.exports.loginPatient = async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const patient = await patientModel.findOne({ email }).select('+password');

    if (!patient) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await patient.comparePassword(password);

    if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = patient.generateAuthToken();

    res.cookie('token', token);

    res.status(200).json({ token, patient });
}

module.exports.getPatientProfile = async (req, res, next) => {

    res.status(200).json(req.user); // Note: req.user might need to be renamed to req.patient in middleware later

}

module.exports.logoutPatient = async (req, res, next) => {
    res.clearCookie('token');
    const token = req.cookies.token || req.headers.authorization.split(' ')[1];

    await blackListTokenModel.create({ token });

    res.status(200).json({ message: 'Logged out' });

}
