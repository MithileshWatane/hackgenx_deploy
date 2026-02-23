import express from "express";
import {
  baselineSchedule,
  optimizedSchedule,
  predictWaitTime,
} from "../controllers/schedulerController.js";

const router = express.Router();

// 🔹 Baseline Scheduling
// POST /api/schedule/baseline
router.post("/baseline", baselineSchedule);

// 🔹 Optimized Scheduling
// POST /api/schedule/optimize
router.post("/optimize", optimizedSchedule);

// 🔹 Predict Wait Time for Queue Patient
// POST /api/schedule/predict-wait-time
router.post("/predict-wait-time", predictWaitTime);

export default router;
