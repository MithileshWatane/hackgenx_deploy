const ambulanceDriverModel = require('../models/ambulanceDriver.model');


module.exports.createAmbulanceDriver = async ({
    firstname, lastname, email, password, color, plate, capacity, ambulanceType
}) => {
    if (!firstname || !email || !password || !color || !plate || !capacity || !ambulanceType) {
        throw new Error('All fields are required');
    }
    const ambulanceDriver = ambulanceDriverModel.create({
        fullname: {
            firstname,
            lastname
        },
        email,
        password,
        ambulance: {
            color,
            plate,
            capacity,
            ambulanceType
        }
    })

    return ambulanceDriver;
}
