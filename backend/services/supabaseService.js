import { supabase } from "../db/supabaseClient.js";

export class SupabaseService {
  /**
   * Execute a SQL query by parsing it and using Supabase query builder
   * This avoids issues with raw SQL execution and quote handling
   */
  async executeQuery(sqlQuery) {
    try {
      console.log("Parsing and executing SQL query:", sqlQuery);

      // Parse the SQL query to extract table, columns, and conditions
      const parsed = this.parseSQLQuery(sqlQuery);
      
      if (!parsed) {
        throw new Error("Unable to parse SQL query");
      }

      console.log("Parsed query:", parsed);

      // Handle COUNT queries specially
      if (parsed.isCount) {
        let query = supabase.from(parsed.table).select('*', { count: 'exact', head: true });
        
        // Apply WHERE conditions for count
        if (parsed.where) {
          parsed.where.forEach(condition => {
            if (condition.operator === '=') {
              query = query.eq(condition.column, condition.value);
            } else if (condition.operator === 'ILIKE' || condition.operator === 'ilike') {
              query = query.ilike(condition.column, condition.value);
            } else if (condition.operator === '>') {
              query = query.gt(condition.column, condition.value);
            } else if (condition.operator === '<') {
              query = query.lt(condition.column, condition.value);
            } else if (condition.operator === '>=') {
              query = query.gte(condition.column, condition.value);
            } else if (condition.operator === '<=') {
              query = query.lte(condition.column, condition.value);
            }
          });
        }

        const { count, error } = await query;

        if (error) {
          console.error("Count query execution error:", error);
          throw error;
        }

        console.log("Count query executed successfully. Count:", count);
        return [{ count: count }];
      }

      // Build and execute regular SELECT query using Supabase query builder
      let query = supabase.from(parsed.table).select(parsed.columns);

      // Apply WHERE conditions
      if (parsed.where) {
        parsed.where.forEach(condition => {
          if (condition.operator === '=') {
            query = query.eq(condition.column, condition.value);
          } else if (condition.operator === 'ILIKE' || condition.operator === 'ilike') {
            query = query.ilike(condition.column, condition.value);
          } else if (condition.operator === '>') {
            query = query.gt(condition.column, condition.value);
          } else if (condition.operator === '<') {
            query = query.lt(condition.column, condition.value);
          } else if (condition.operator === '>=') {
            query = query.gte(condition.column, condition.value);
          } else if (condition.operator === '<=') {
            query = query.lte(condition.column, condition.value);
          }
        });
      }

      // Apply ORDER BY
      if (parsed.orderBy) {
        query = query.order(parsed.orderBy.column, { ascending: parsed.orderBy.ascending });
      }

      // Apply LIMIT
      if (parsed.limit) {
        query = query.limit(parsed.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Query execution error:", error);
        throw error;
      }

      console.log("Query executed successfully. Rows returned:", data?.length || 0);
      return data || [];
    } catch (error) {
      console.error("Error in executeQuery:", error);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Parse a SQL query string into components for Supabase query builder
   */
  parseSQLQuery(sqlQuery) {
    try {
      // Remove extra whitespace and normalize
      const normalized = sqlQuery.trim().replace(/\s+/g, ' ');
      
      // Check if it's a COUNT query
      const isCount = /SELECT\s+COUNT\s*\(\s*\*?\s*\)/i.test(normalized);
      
      // Extract SELECT columns
      const selectMatch = normalized.match(/SELECT\s+(.*?)\s+FROM/i);
      if (!selectMatch) return null;
      const columns = selectMatch[1].trim() === '*' ? '*' : selectMatch[1].trim();

      // Extract table name
      const tableMatch = normalized.match(/FROM\s+(\w+)/i);
      if (!tableMatch) return null;
      const table = tableMatch[1];

      // Extract WHERE conditions
      const where = [];
      const whereMatch = normalized.match(/WHERE\s+(.*?)(?:ORDER BY|LIMIT|$)/i);
      if (whereMatch) {
        const whereClause = whereMatch[1].trim();
        // Parse simple conditions (column = 'value' or column operator value)
        const conditions = whereClause.split(/\s+AND\s+/i);
        conditions.forEach(condition => {
          // Match: column operator 'value' or column operator value
          const condMatch = condition.match(/(\w+)\s*(=|>|<|>=|<=|ILIKE|ilike)\s*'?([^']+)'?/i);
          if (condMatch) {
            where.push({
              column: condMatch[1],
              operator: condMatch[2],
              value: condMatch[3].replace(/'/g, '') // Remove quotes from value
            });
          }
        });
      }

      // Extract ORDER BY
      let orderBy = null;
      const orderMatch = normalized.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
      if (orderMatch) {
        orderBy = {
          column: orderMatch[1],
          ascending: !orderMatch[2] || orderMatch[2].toUpperCase() === 'ASC'
        };
      }

      // Extract LIMIT
      let limit = null;
      const limitMatch = normalized.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        limit = parseInt(limitMatch[1]);
      }

      return { table, columns, where, orderBy, limit, isCount };
    } catch (error) {
      console.error("Error parsing SQL query:", error);
      return null;
    }
  }

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
        is_emergency: patientDetails.isEmergency || false,
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

      // Step 5: Add to appropriate queue based on emergency status
      try {
        if (patientDetails.isEmergency) {
          await this.addToICUQueue(appointment);
        } else {
          await this.addToOPDQueue(appointment);
        }
      } catch (queueError) {
        console.warn(
          "Warning: Failed to add to queue:",
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

  async addToICUQueue(appointment) {
    try {
      const icuQueueEntry = {
        patient_token: appointment.token_number,
        patient_name: appointment.patient_name,
        diseases: appointment.disease,
        doctor_id: appointment.doctor_id,
        is_emergency: true,
        severity: "critical",
        status: "waiting",
        time: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("Adding to ICU queue:", icuQueueEntry);

      const { error: insertError } = await supabase
        .from("icu_queue")
        .insert([icuQueueEntry]);

      if (insertError) {
        console.error("Error adding to ICU queue:", insertError);
        throw insertError;
      }

      console.log("Successfully added to ICU queue");
    } catch (error) {
      console.error("ICU Queue Error:", error);
      throw error;
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
