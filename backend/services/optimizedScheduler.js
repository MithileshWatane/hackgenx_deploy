import { supabase } from "../db/supabaseClient.js";

// assign rank/number encoding to patient type.
const severityRank = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

// baseline brute-force method for scheduling.
function scheduleOnce(patients, beds) {
  const bedAvailability = {};
  beds.forEach((bed) => {
    bedAvailability[bed.bed_id] = new Date(0);
  });

  let totalWaiting = 0;
  let admittedCount = 0;
  const admissions = [];

  for (const patient of patients) {
    if (!patient.arrival_time) continue;

    const arrival = new Date(patient.arrival_time);
    if (isNaN(arrival.getTime())) continue;

    let bestBed = null;
    let bestStartTime = null;

    for (const bed of beds) {
      const compatible =
        (!patient.ventilator_needed || bed.ventilator_available) &&
        (!patient.dialysis_needed || bed.dialysis_available);

      if (!compatible) continue;

      const availableFrom = bedAvailability[bed.bed_id];

      const startTime = arrival > availableFrom ? arrival : availableFrom;

      if (!bestStartTime || startTime < bestStartTime) {
        bestBed = bed;
        bestStartTime = startTime;
      }
    }

    if (!bestBed) continue;

    const dischargeTime = new Date(bestStartTime);
    dischargeTime.setDate(
      dischargeTime.getDate() + patient.predicted_stay_days
    );

    const waitingHours = Math.floor(
      (bestStartTime - arrival) / (1000 * 60 * 60)
    );

    totalWaiting += waitingHours;
    admittedCount++;

    bedAvailability[bestBed.bed_id] = dischargeTime;

    admissions.push({
      patient_id: patient.patient_id,
      bed_id: bestBed.bed_id,
      admission_time: bestStartTime.toISOString(),
      discharge_time: dischargeTime.toISOString(),
      waiting_hours: waitingHours,
    });
  }

  return {
    totalWaiting,
    admittedCount,
    admissions,
  };
}

// optimized method for scheduling
export async function runOptimizedScheduler(iterations = 20) {
  const { data: patients, error: pError } = await supabase
    .from("patients_new")
    .select("*");

  const { data: beds, error: bError } = await supabase
    .from("icu_beds")
    .select("*");

  if (pError) throw new Error(pError.message);
  if (bError) throw new Error(bError.message);

  if (!patients?.length) throw new Error("No patients found");
  if (!beds?.length) throw new Error("No beds found");

  let bestResult = null;

  for (let i = 0; i < iterations; i++) {
    // 🔥 Random-Key Priority Score
    const randomizedPatients = [...patients].map((p) => ({
      ...p,
      priorityScore:
        Math.random() * 0.4 +
        (p.is_emergency ? 0.3 : 0) +
        (severityRank[p.severity] || 0) * 0.1,
    }));

    randomizedPatients.sort((a, b) => b.priorityScore - a.priorityScore);

    const result = scheduleOnce(randomizedPatients, beds);

    if (!bestResult || result.totalWaiting < bestResult.totalWaiting) {
      bestResult = result;
    }
  }

  // Clear old admissions
  await supabase.from("admissions").delete().neq("id", "");

  if (bestResult.admissions.length > 0) {
    await supabase.from("admissions").insert(bestResult.admissions);
  }

  return {
    totalWaitingHours: bestResult.totalWaiting,
    averageWaitingHours:
      bestResult.admittedCount > 0
        ? bestResult.totalWaiting / bestResult.admittedCount
        : 0,
    admittedPatients: bestResult.admittedCount,
    optimizationRuns: iterations,
  };
}

// Predict wait time for a specific patient in ICU queue
export async function predictQueueWaitTime(patientToken, iterations = 20) {
  // Fetch waiting patients from icu_queue
  const { data: queuePatients, error: qError } = await supabase
    .from("icu_queue")
    .select("*")
    .eq("status", "waiting");

  // Fetch assigned patients to know current bed occupancy
  const { data: assignedPatients, error: aError } = await supabase
    .from("icu_queue")
    .select("*, icu_beds(bed_id, ventilator_available, dialysis_available)")
    .eq("status", "assigned");

  // Fetch ICU beds
  const { data: beds, error: bError } = await supabase
    .from("icu_beds")
    .select("*");

  if (qError) throw new Error(qError.message);
  if (bError) throw new Error(bError.message);

  if (!queuePatients?.length) throw new Error("No patients in queue");
  if (!beds?.length) throw new Error("No ICU beds available");

  // Find target patient
  const targetPatient = queuePatients.find((p) => p.patient_token === patientToken);
  if (!targetPatient) {
    throw new Error(`Patient with token ${patientToken} not found in queue`);
  }

  // Build bed availability map from assigned patients
  const bedAvailability = {};
  beds.forEach((bed) => {
    bedAvailability[bed.bed_id] = new Date(); // Start from now
  });

  // Update bed availability based on assigned patients
  if (assignedPatients?.length) {
    assignedPatients.forEach((assigned) => {
      if (assigned.discharge_time) {
        const dischargeTime = new Date(assigned.discharge_time);
        const bedId = assigned.assigned_bed_id || assigned.bed_id;
        if (bedId && dischargeTime > bedAvailability[bedId]) {
          bedAvailability[bedId] = dischargeTime;
        }
      }
    });
  }

  // Convert queue patients to format compatible with scheduleOnce
  const formattedPatients = queuePatients.map((p) => ({
    patient_id: p.patient_token,
    arrival_time: p.time || new Date().toISOString(),
    predicted_stay_days: p.predicted_stay_days || 3,
    severity: p.severity || "Medium",
    is_emergency: p.is_emergency || false,
    ventilator_needed: p.ventilator_needed || false,
    dialysis_needed: p.dialysis_needed || false,
  }));

  // Run multiple iterations to find best and average wait times
  let bestResult = null;
  const waitTimeResults = [];

  for (let i = 0; i < iterations; i++) {
    // Reset bed availability for each iteration
    const iterationBedAvailability = { ...bedAvailability };

    // Apply priority scoring
    const randomizedPatients = [...formattedPatients].map((p) => ({
      ...p,
      priorityScore:
        Math.random() * 0.4 +
        (p.is_emergency ? 0.3 : 0) +
        (severityRank[p.severity] || 0) * 0.1,
    }));

    randomizedPatients.sort((a, b) => b.priorityScore - a.priorityScore);

    // Run schedule simulation
    const result = scheduleOnceWithAvailability(
      randomizedPatients,
      beds,
      iterationBedAvailability
    );

    // Find target patient in results
    const targetAdmission = result.admissions.find(
      (a) => a.patient_id === patientToken
    );

    if (targetAdmission) {
      waitTimeResults.push(targetAdmission.waiting_hours);

      if (!bestResult || result.totalWaiting < bestResult.totalWaiting) {
        bestResult = {
          totalWaiting: result.totalWaiting,
          targetWaitHours: targetAdmission.waiting_hours,
          admission: targetAdmission,
        };
      }
    }
  }

  if (waitTimeResults.length === 0) {
    throw new Error("Could not schedule patient - no compatible beds available");
  }

  // Calculate statistics
  const avgWaitHours =
    waitTimeResults.reduce((a, b) => a + b, 0) / waitTimeResults.length;
  const minWaitHours = Math.min(...waitTimeResults);
  const maxWaitHours = Math.max(...waitTimeResults);
  const variance =
    waitTimeResults.reduce((sum, val) => sum + Math.pow(val - avgWaitHours, 2), 0) /
    waitTimeResults.length;
  const stdDeviation = Math.sqrt(variance);

  // Determine confidence based on variance
  let confidence = "medium";
  if (stdDeviation < 2) confidence = "high";
  else if (stdDeviation > 6) confidence = "low";

  return {
    patient_token: patientToken,
    estimated_wait_hours: Math.round(avgWaitHours),
    best_case_hours: minWaitHours,
    worst_case_hours: maxWaitHours,
    confidence,
    simulation_runs: waitTimeResults.length,
    queue_position: queuePatients.findIndex((p) => p.patient_token === patientToken) + 1,
    total_queue_length: queuePatients.length,
  };
}

// Helper function for prediction that accepts initial bed availability
function scheduleOnceWithAvailability(patients, beds, initialBedAvailability) {
  const bedAvailability = { ...initialBedAvailability };
  let totalWaiting = 0;
  let admittedCount = 0;
  const admissions = [];

  for (const patient of patients) {
    if (!patient.arrival_time) continue;

    const arrival = new Date(patient.arrival_time);
    if (isNaN(arrival.getTime())) continue;

    let bestBed = null;
    let bestStartTime = null;

    for (const bed of beds) {
      const compatible =
        (!patient.ventilator_needed || bed.ventilator_available) &&
        (!patient.dialysis_needed || bed.dialysis_available);

      if (!compatible) continue;

      const availableFrom = bedAvailability[bed.bed_id];
      const startTime = arrival > availableFrom ? arrival : availableFrom;

      if (!bestStartTime || startTime < bestStartTime) {
        bestBed = bed;
        bestStartTime = startTime;
      }
    }

    if (!bestBed) continue;

    const dischargeTime = new Date(bestStartTime);
    dischargeTime.setDate(dischargeTime.getDate() + patient.predicted_stay_days);

    const waitingHours = Math.floor(
      (bestStartTime - arrival) / (1000 * 60 * 60)
    );

    totalWaiting += waitingHours;
    admittedCount++;

    bedAvailability[bestBed.bed_id] = dischargeTime;

    admissions.push({
      patient_id: patient.patient_id,
      bed_id: bestBed.bed_id,
      admission_time: bestStartTime.toISOString(),
      discharge_time: dischargeTime.toISOString(),
      waiting_hours: waitingHours,
    });
  }

  return {
    totalWaiting,
    admittedCount,
    admissions,
  };
}
