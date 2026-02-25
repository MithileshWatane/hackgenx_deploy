import { getTopNearbyHospitals } from "../services/nearbyHospitalsService.js";

export async function getNearbyHospitals(req, res) {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        status: "error",
        message: "Latitude and Longitude required",
      });
    }

    const result = await getTopNearbyHospitals(
      Number(latitude),
      Number(longitude)
    );

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
