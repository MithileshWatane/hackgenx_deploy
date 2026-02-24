import { supabase } from "../db/supabaseClient.js";

// Haversine Distance Formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getTopNearbyHospitals(userLat, userLon) {
  // 1️⃣ Fetch all hospitals (doctors)
  const { data: hospitals, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("role", "doctor");

  if (error) throw new Error(error.message);

  const enrichedHospitals = [];

  for (const hospital of hospitals) {
    if (!hospital.latitude || !hospital.longitude) continue;

    // 2️⃣ Calculate distance
    const distance = calculateDistance(
      userLat,
      userLon,
      Number(hospital.latitude),
      Number(hospital.longitude)
    );

    // 3️⃣ Get available ICU and General beds
    const [icuRes, generalRes] = await Promise.all([
      supabase
        .from("icu_beds")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", hospital.id)
        .eq("is_available", true),
      supabase
        .from("beds")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", hospital.id)
        .eq("status", "available")
    ]);

    const icuAvailable = icuRes.count || 0;
    const generalAvailable = generalRes.count || 0;

    // 4️⃣ Get ICU waiting time
    const { data: waitingQueue } = await supabase
      .from("icu_queue")
      .select("time")
      .eq("doctor_id", hospital.id)
      .eq("status", "waiting");

    // 5️⃣ Get OPD waiting time (Moving Average Algorithm)
    const { data: opdHistory, error: opdError } = await supabase
      .from("opd_queue")
      .select("actual_wait_minutes")
      .eq("doctor_id", hospital.id)
      .eq("status", "completed")
      .not("actual_wait_minutes", "is", null)
      .order("completed_at", { ascending: false })
      .limit(5); // MOVING_AVG_WINDOW = 5

    let opdWaitingMinutes = 15; // Default

    if (opdHistory && opdHistory.length > 0) {
      const sum = opdHistory.reduce((s, r) => s + parseFloat(r.actual_wait_minutes), 0);
      opdWaitingMinutes = Math.round(sum / opdHistory.length);
    }

    let avgWaitingMinutes = 0;

    if (waitingQueue && waitingQueue.length > 0) {
      const now = new Date();

      const totalMinutes = waitingQueue.reduce((sum, patient) => {
        const arrival = new Date(patient.time);
        const diff = (now - arrival) / (1000 * 60);
        return sum + diff;
      }, 0);

      avgWaitingMinutes = totalMinutes / waitingQueue.length;
    }

    enrichedHospitals.push({
      hospital_name: hospital.name,
      address: `${hospital.city}, ${hospital.state}`,
      zip_code: hospital.zip_code,
      distance_km: distance.toFixed(2),
      icu_waiting_minutes: Math.round(avgWaitingMinutes),
      icu_beds_available: icuAvailable,
      general_beds_available: generalAvailable,
      opd_waiting_minutes: opdWaitingMinutes,
    });
  }

  // 5️⃣ Sort by shortest wait time (Primary) and nearest distance (Secondary)
  enrichedHospitals.sort((a, b) => {
    if (a.opd_waiting_minutes !== b.opd_waiting_minutes) {
      return a.opd_waiting_minutes - b.opd_waiting_minutes;
    }
    return a.distance_km - b.distance_km;
  });

  // 6️⃣ Return Top 3
  return enrichedHospitals.slice(0, 3);
}
