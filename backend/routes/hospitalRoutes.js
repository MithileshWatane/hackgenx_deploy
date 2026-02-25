import express from "express";
import { getNearbyHospitals } from "../controllers/hospitalController.js";
import { getNearbyHospitalsForMap } from "../controllers/hospitalController.js";
const router = express.Router();

router.post("/nearby", getNearbyHospitals);
router.get("/nearby", getNearbyHospitalsForMap);
export default router;
