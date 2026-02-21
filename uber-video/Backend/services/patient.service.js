const patientModel = require('../models/patient.model');


module.exports.createPatient = async ({
    firstname, lastname, email, password
}) => {
    if (!firstname || !email || !password) {
        throw new Error('All fields are required');
    }
    const patient = patientModel.create({
        fullname: {
            firstname,
            lastname
        },
        email,
        password
    })

    return patient;
}
