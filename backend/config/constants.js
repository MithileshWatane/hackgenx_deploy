export const APP_CONSTANTS = {
  APPOINTMENT_STATUS: {
    SCHEDULED: "scheduled",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  },
  DOCTOR_IDS: {
    // You can fetch these dynamically from your database
    // For now, these are placeholder UUIDs
    DR_SMITH: "00000000-0000-0000-0000-000000000001",
    DR_JOHNSON: "00000000-0000-0000-0000-000000000002",
    DR_WILLIAMS: "00000000-0000-0000-0000-000000000003",
  },
  SYSTEM_PROMPT: `You are a helpful hospital assistant for querying patient data.
  Convert natural language questions into SQL queries for Supabase.
  Available tables: appointments, bed_queue, beds, daily_rounds, discharge_predictions, medical_reports, opd_queue, patients, patients_new, queues, user_profiles.
  
  Rules:
  1. Always use single quotes for strings
  2. Use proper table joins when needed
  3. Return ONLY the SQL query, no explanations
  4. For patient queries using token_number, always filter by token_number
  5. Use ilike for text searches when appropriate
  
  Example:
  User: "Show me my appointments" (token: ABC123)
  SQL: SELECT * FROM appointments WHERE token_number = 'ABC123' ORDER BY appointment_date DESC;`,
};
