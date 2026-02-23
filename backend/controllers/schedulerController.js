import { runBaselineScheduler } from "../services/icuScheduler.js";
import { runOptimizedScheduler, predictQueueWaitTime } from "../services/optimizedScheduler.js";

// POST http://localhost:5000/api/schedule/baseline
export async function baselineSchedule(req, res) {
  try {
    const result = await runBaselineScheduler();

    res.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
}

// POST http://localhost:5000/api/schedule/optimize
export async function optimizedSchedule(req, res) {
  try {
    const result = await runOptimizedScheduler(30);

    res.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
}

// POST http://localhost:5000/api/schedule/predict-wait-time
export async function predictWaitTime(req, res) {
  try {
    const { patient_token, iterations } = req.body;

    if (!patient_token) {
      return res.status(400).json({
        status: "error",
        message: "patient_token is required",
      });
    }

    const result = await predictQueueWaitTime(patient_token, iterations || 20);

    res.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
}
