import { getTopNearbyHospitals } from "../services/nearbyHospitalsService.js";
import { calculateDistance } from "../utils/calculateDistance.js";
import { supabase } from "../db/supabaseClient.js";
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
export const getNearbyHospitalsForMap = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        status: "error",
        message: "Latitude and Longitude are required",
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    // 1️⃣ Fetch hospitals (from user_profiles)
    const { data: hospitals, error } = await supabase
      .from("user_profiles")
      .select("id, name, city, state, country, latitude, longitude")
      .eq("role", "doctor") // change to 'hospital' if needed
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (error) throw error;

    // 2️⃣ Calculate distance + available beds
    const enrichedHospitals = await Promise.all(
      hospitals.map(async (hospital) => {
        const distance = calculateDistance(
          userLat,
          userLng,
          hospital.latitude,
          hospital.longitude
        );

        const { count } = await supabase
          .from("beds")
          .select("*", { count: "exact", head: true })
          .eq("doctor_id", hospital.id)
          .eq("status", "available");

        return {
          id: hospital.id,
          name: hospital.name,
          city: hospital.city,
          state: hospital.state,
          country: hospital.country,
          latitude: hospital.latitude,
          longitude: hospital.longitude,
          total_beds_available: count || 0,
          distance: Number(distance.toFixed(2)),
        };
      })
    );

    // 3️⃣ Sort by nearest
    enrichedHospitals.sort((a, b) => a.distance - b.distance);

    // 4️⃣ Send top 3
    return res.json({
      status: "success",
      data: enrichedHospitals.slice(0, 3),
    });
  } catch (error) {
    console.error("Nearby hospital error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};
