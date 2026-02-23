import { supabase } from "../db/supabaseClient.js";

export class SupabaseService {
  async bookAppointment(patientDetails) {
    try {
      console.log("Starting appointment booking with details:", patientDetails);

      // Step 1: Get a valid doctor ID from user_profiles
      const doctorId = await this.getValidDoctorId(patientDetails.doctorId);

      if (!doctorId) {
        throw new Error(
          "No doctor available. Please contact hospital administration."
        );
      }

      // Step 2: Generate unique token number
      const tokenNumber = await this.generateUniqueTokenNumber();

      // Step 3: Prepare appointment data
      const appointmentData = {
        patient_name: patientDetails.name.trim(),
        age: parseInt(patientDetails.age),
        disease: patientDetails.disease || "General Checkup",
        phone: patientDetails.phone.trim(),
        email: patientDetails.email.trim().toLowerCase(),
        appointment_date:
          patientDetails.appointmentDate || new Date().toISOString(),
        doctor_id: doctorId,
        status: "scheduled",
        token_number: tokenNumber,
        notes: patientDetails.notes || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("Inserting appointment with data:", appointmentData);

      // Step 4: Insert the appointment
      const { data, error } = await supabase
        .from("appointments")
        .insert([appointmentData])
        .select();

      if (error) {
        console.error("Supabase insert error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Failed to book appointment: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned after appointment insertion");
      }

      const appointment = data[0];
      console.log("Appointment created successfully:", appointment);

      // Step 5: Add to OPD queue (optional - don't fail if this fails)
      try {
        await this.addToOPDQueue(appointment);
      } catch (queueError) {
        console.warn(
          "Warning: Failed to add to OPD queue:",
          queueError.message
        );
        // Continue - appointment is still created
      }

      return appointment;
    } catch (error) {
      console.error("Booking Error in bookAppointment:", error);
      throw error;
    }
  }

  async getValidDoctorId(requestedDoctorId) {
    try {
      // First, check if the requested doctor ID exists and is valid
      if (requestedDoctorId) {
        const { data: doctor, error } = await supabase
          .from("user_profiles")
          .select("id, role")
          .eq("id", requestedDoctorId)
          .eq("role", "doctor")
          .maybeSingle();

        if (!error && doctor) {
          console.log("Using requested doctor ID:", doctor.id);
          return doctor.id;
        }
        console.log(
          "Requested doctor ID not found or not a doctor:",
          requestedDoctorId
        );
      }

      // If no valid requested doctor, get any available doctor
      const { data: doctors, error: doctorsError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("role", "doctor")
        .limit(1);

      if (doctorsError) {
        console.error("Error fetching doctors:", doctorsError);
        return null;
      }

      if (!doctors || doctors.length === 0) {
        console.log("No doctors found in user_profiles");

        // Fallback: Try to get from auth.users directly (if you have permissions)
        const { data: authDoctors, error: authError } = await supabase
          .from("auth.users")
          .select("id")
          .limit(1);

        if (!authError && authDoctors && authDoctors.length > 0) {
          console.log("Using auth.users ID as fallback:", authDoctors[0].id);
          return authDoctors[0].id;
        }

        return null;
      }

      console.log("Using available doctor ID:", doctors[0].id);
      return doctors[0].id;
    } catch (error) {
      console.error("Error in getValidDoctorId:", error);
      return null;
    }
  }

  async generateUniqueTokenNumber() {
    const prefix = "TOK";
    let tokenNumber;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      // Generate token: TOK + timestamp + random 3 digits
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      tokenNumber = `${prefix}${timestamp}${random}`;

      // Check if token already exists
      const { data, error } = await supabase
        .from("appointments")
        .select("token_number")
        .eq("token_number", tokenNumber)
        .maybeSingle();

      if (error) {
        console.error("Error checking token uniqueness:", error);
        // If we can't check, continue with generated token
        isUnique = true;
      } else {
        isUnique = !data;
      }

      attempts++;
    }

    if (!isUnique) {
      // Final fallback: add milliseconds to ensure uniqueness
      tokenNumber = `${prefix}${Date.now()}${Math.floor(
        Math.random() * 10000
      )}`;
    }

    console.log("Generated unique token number:", tokenNumber);
    return tokenNumber;
  }

  async addToOPDQueue(appointment) {
    try {
      // Get current max queue position for the specific doctor
      const { data: queueData, error: queueError } = await supabase
        .from("opd_queue")
        .select("queue_position")
        .eq("doctor_id", appointment.doctor_id)
        .order("queue_position", { ascending: false })
        .limit(1);

      if (queueError) {
        console.error("Error getting queue position:", queueError);
        return;
      }

      const nextPosition =
        queueData && queueData.length > 0 ? queueData[0].queue_position + 1 : 1;

      const queueEntry = {
        appointment_id: appointment.id,
        patient_name: appointment.patient_name,
        disease: appointment.disease,
        token_number: appointment.token_number,
        doctor_id: appointment.doctor_id,
        queue_position: nextPosition,
        status: "waiting",
        entered_queue_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      console.log("Adding to OPD queue:", queueEntry);

      const { error: insertError } = await supabase
        .from("opd_queue")
        .insert([queueEntry]);

      if (insertError) {
        console.error("Error adding to OPD queue:", insertError);
        throw insertError;
      }

      console.log("Successfully added to OPD queue");
    } catch (error) {
      console.error("OPD Queue Error:", error);
      throw error; // Re-throw to handle in calling function
    }
  }

  async getPatientByToken(tokenNumber) {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          *,
          opd_queue (
            queue_position,
            status,
            entered_queue_at,
            estimated_wait_minutes
          )
        `
        )
        .eq("token_number", tokenNumber)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching patient by token:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error in getPatientByToken:", error);
      return null;
    }
  }

  async getPatientHistory(tokenNumber) {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          *,
          opd_queue (
            queue_position,
            status,
            entered_queue_at,
            consultation_started_at,
            completed_at
          ),
          bed_queue (
            id,
            status,
            bed_type,
            admitted_from_opd_at,
            bed_assigned_at,
            admitted_at,
            discharged_at,
            beds (
              bed_number,
              bed_type,
              status
            ),
            daily_rounds (
              id,
              round_date,
              temperature,
              heart_rate,
              blood_pressure,
              oxygen_level,
              condition_status,
              doctor_notes
            ),
            medical_reports (
              id,
              file_url,
              report_type,
              ai_summary,
              created_at
            ),
            discharge_predictions (
              predicted_discharge_date,
              remaining_days,
              confidence,
              reasoning
            )
          )
        `
        )
        .eq("token_number", tokenNumber)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching patient history:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error in getPatientHistory:", error);
      return [];
    }
  }

  async getAppointmentStatus(tokenNumber) {
    try {
      const { data, error } = await supabase
        .from("opd_queue")
        .select(
          `
          *,
          appointments (
            patient_name,
            age,
            disease,
            phone,
            email,
            appointment_date
          )
        `
        )
        .eq("token_number", tokenNumber)
        .order("entered_queue_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching appointment status:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error in getAppointmentStatus:", error);
      return null;
    }
  }

  async updateAppointmentStatus(tokenNumber, status) {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .update({
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("token_number", tokenNumber)
        .select()
        .single();

      if (error) {
        console.error("Error updating appointment status:", error);
        throw error;
      }

      // Also update OPD queue if exists
      await supabase
        .from("opd_queue")
        .update({ status: status })
        .eq("token_number", tokenNumber);

      return data;
    } catch (error) {
      console.error("Error in updateAppointmentStatus:", error);
      throw error;
    }
  }

  async cancelAppointment(tokenNumber) {
    return this.updateAppointmentStatus(tokenNumber, "cancelled");
  }

  async getDoctors() {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, role")
        .eq("role", "doctor");

      if (error) {
        console.error("Error fetching doctors:", error);
        return [];
      }

      return data.map((doctor) => ({
        id: doctor.id,
        email: doctor.email,
        name: doctor.email.split("@")[0], // Use email prefix as name
      }));
    } catch (error) {
      console.error("Error in getDoctors:", error);
      return [];
    }
  }
}
