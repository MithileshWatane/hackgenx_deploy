import { SupabaseService } from "../services/supabaseService.js";
import { validateAppointment } from "../utils/validators.js";

const supabaseService = new SupabaseService();

export const bookAppointment = async (req, res, next) => {
  try {
    const {
      name,
      age,
      phone,
      email,
      disease,
      appointmentDate,
      doctorId,
      notes,
    } = req.body;

    console.log("Received appointment booking request:", {
      name,
      age,
      phone,
      email,
      disease,
      appointmentDate,
      doctorId,
    });

    // Validate input
    const validationError = validateAppointment(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError,
      });
    }

    // Book appointment
    const appointment = await supabaseService.bookAppointment({
      name,
      age: parseInt(age),
      phone,
      email,
      disease: disease || "General Checkup",
      appointmentDate: appointmentDate || new Date().toISOString(),
      doctorId,
      notes,
    });

    // Get queue position
    const queueStatus = await supabaseService.getAppointmentStatus(
      appointment.token_number
    );

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: {
        appointmentId: appointment.id,
        tokenNumber: appointment.token_number,
        patientName: appointment.patient_name,
        appointmentDate: appointment.appointment_date,
        doctorId: appointment.doctor_id,
        status: appointment.status,
        queuePosition: queueStatus?.queue_position || null,
        estimatedWaitTime: queueStatus?.estimated_wait_minutes || null,
      },
    });
  } catch (error) {
    console.error("Appointment booking controller error:", error);

    // Handle specific error cases
    if (error.message.includes("No doctor available")) {
      res.status(503).json({
        success: false,
        error: "Service temporarily unavailable",
        details:
          "No doctors are currently available. Please try again later or contact hospital administration.",
      });
    } else if (error.message.includes("duplicate key value")) {
      res.status(409).json({
        success: false,
        error: "Duplicate entry",
        details: "An appointment with this information already exists.",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to book appointment",
        details: error.message,
      });
    }
  }
};

export const getAppointmentStatus = async (req, res, next) => {
  try {
    const { tokenNumber } = req.params;

    if (!tokenNumber) {
      return res.status(400).json({
        success: false,
        error: "Token number is required",
      });
    }

    const appointment = await supabaseService.getPatientByToken(tokenNumber);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    const queueStatus = await supabaseService.getAppointmentStatus(tokenNumber);

    res.json({
      success: true,
      data: {
        ...appointment,
        currentQueue: queueStatus
          ? {
              position: queueStatus.queue_position,
              status: queueStatus.status,
              enteredAt: queueStatus.entered_queue_at,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const { tokenNumber } = req.params;

    if (!tokenNumber) {
      return res.status(400).json({
        success: false,
        error: "Token number is required",
      });
    }

    const appointment = await supabaseService.cancelAppointment(tokenNumber);

    res.json({
      success: true,
      message: "Appointment cancelled successfully",
      data: {
        tokenNumber: appointment.token_number,
        status: appointment.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDoctors = async (req, res, next) => {
  try {
    const doctors = await supabaseService.getDoctors();

    res.json({
      success: true,
      data: doctors,
    });
  } catch (error) {
    next(error);
  }
};
