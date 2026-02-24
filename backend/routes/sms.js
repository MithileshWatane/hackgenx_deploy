import express from "express";
import { sendSMS, sendBedSMS } from "../controllers/smsController.js";

const router = express.Router();

// POST /api/sms/send
router.post("/send", sendSMS);

// POST /api/sms/send-bed-notification
router.post("/send-bed-notification", sendBedSMS);

export default router;
