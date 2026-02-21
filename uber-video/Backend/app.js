const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const app = express();
const cookieParser = require('cookie-parser');
const connectToDb = require('./db/db');
const patientRoutes = require('./routes/patient.routes');
const ambulanceRoutes = require('./routes/ambulance.routes');
const mapsRoutes = require('./routes/maps.routes');
const emergencyRoutes = require('./routes/emergency.routes');

connectToDb();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());



app.get('/', (req, res) => {
    res.send('Hello World');
});

app.use('/patients', patientRoutes);
app.use('/ambulance-drivers', ambulanceRoutes);
app.use('/maps', mapsRoutes);
app.use('/emergencies', emergencyRoutes);




module.exports = app;
