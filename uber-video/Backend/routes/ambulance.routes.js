const ambulanceController = require('../controllers/ambulance.controller');
const express = require('express');
const router = express.Router();
const { body } = require("express-validator")
const authMiddleware = require('../middlewares/auth.middleware');


router.post('/register', [
    body('email').isEmail().withMessage('Invalid Email'),
    body('fullname.firstname').isLength({ min: 3 }).withMessage('First name must be at least 3 characters long'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('ambulance.color').isLength({ min: 3 }).withMessage('Color must be at least 3 characters long'),
    body('ambulance.plate').isLength({ min: 3 }).withMessage('Plate must be at least 3 characters long'),
    body('ambulance.capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
    body('ambulance.ambulanceType').isIn(['Basic', 'ICU', 'Ventilator']).withMessage('Invalid ambulance type')
],
    ambulanceController.registerAmbulanceDriver
)


router.post('/login', [
    body('email').isEmail().withMessage('Invalid Email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
],
    ambulanceController.loginAmbulanceDriver
)


router.get('/profile', authMiddleware.authAmbulanceDriver, ambulanceController.getAmbulanceDriverProfile)

router.get('/logout', authMiddleware.authAmbulanceDriver, ambulanceController.logoutAmbulanceDriver)


module.exports = router;
