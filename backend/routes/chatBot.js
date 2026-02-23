import express from "express";
import {
  processChatbotQuery,
  getPatientSummary,
} from "../controllers/chatbotController.js";

const router = express.Router();

router.post("/query", processChatbotQuery);
router.get("/summary/:tokenNumber", getPatientSummary);

export default router;
