import express from "express";
import {
  bookAppointment,
  getAppointmentStatus,
  cancelAppointment,
  getDoctors,
} from "../controllers/appointmentController.js";

const router = express.Router();

// GET endpoints first
router.get("/doctors", getDoctors);
router.get("/status/:tokenNumber", getAppointmentStatus);

// POST endpoints
router.post("/book", bookAppointment);

// PUT endpoints
router.put("/cancel/:tokenNumber", cancelAppointment);

export default router;
