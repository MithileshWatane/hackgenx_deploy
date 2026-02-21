const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const emergencyController = require('../controllers/emergency.controller');
const authMiddleware = require('../middlewares/auth.middleware');


router.post('/create',
    authMiddleware.authPatient,
    body('pickup').isString().isLength({ min: 3 }).withMessage('Invalid pickup address'),
    body('destination').isString().isLength({ min: 3 }).withMessage('Invalid destination address'),
    body('ambulanceType').isString().isIn(['Basic', 'ICU', 'Ventilator']).withMessage('Invalid ambulance type'),
    emergencyController.createEmergencyRequest
)

router.get('/get-fare',
    authMiddleware.authPatient,
    query('pickup').isString().isLength({ min: 3 }).withMessage('Invalid pickup address'),
    query('destination').isString().isLength({ min: 3 }).withMessage('Invalid destination address'),
    emergencyController.getFare
)

router.post('/confirm',
    authMiddleware.authAmbulanceDriver,
    body('emergencyRequestId').isMongoId().withMessage('Invalid emergency request id'),
    emergencyController.confirmEmergencyRequest
)

router.get('/start-trip',
    authMiddleware.authAmbulanceDriver,
    query('emergencyRequestId').isMongoId().withMessage('Invalid emergency request id'),
    query('otp').isString().isLength({ min: 6, max: 6 }).withMessage('Invalid OTP'),
    emergencyController.startMedicalTrip
)

router.post('/end-trip',
    authMiddleware.authAmbulanceDriver,
    body('emergencyRequestId').isMongoId().withMessage('Invalid emergency request id'),
    emergencyController.endMedicalTrip
)



module.exports = router;
