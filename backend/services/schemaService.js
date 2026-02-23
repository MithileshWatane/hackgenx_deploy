/**
 * Service to provide database schema context to Gemini
 */

import { supabase } from "../db/supabaseClient.js";

class SchemaService {
  constructor() {
    this.schemaCache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 3600000; // 1 hour
  }

  async getFormattedSchema() {
    // Return cached schema if valid
    if (
      this.schemaCache &&
      this.cacheTimestamp &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    ) {
      return this.schemaCache;
    }

    try {
      const tables = [
        "patients",
        "user_profiles",
        "appointments",
        "opd_queue",
        "bed_queue",
        "admissions",
        "beds",
        "daily_rounds",
        "medical_reports",
        "discharge_predictions",
        "patients_new",
        "icu_beds",
      ];

      const schemaInfo = [];

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select("*").limit(1);

        if (error) continue;

        if (data && data.length > 0) {
          const columns = Object.keys(data[0]).map((col) => ({
            name: col,
            type: typeof data[0][col],
            sample: data[0][col],
          }));

          schemaInfo.push({ table, columns });
        }
      }

      const formattedSchema = this.formatSchemaForAI(schemaInfo);
      this.schemaCache = formattedSchema;
      this.cacheTimestamp = Date.now();

      return formattedSchema;
    } catch (error) {
      console.error("Error fetching schema:", error);
      return "Database schema unavailable";
    }
  }

  formatSchemaForAI(schemaInfo) {
    let formatted = "Database Schema:\n\n";

    schemaInfo.forEach((table) => {
      formatted += `Table: ${table.table}\nColumns:\n`;
      table.columns.forEach((col) => {
        formatted += `  - ${col.name} (${col.type})\n`;
      });
      formatted += "\n";
    });

    return formatted;
  }

  clearCache() {
    this.schemaCache = null;
    this.cacheTimestamp = null;
  }
}

export default new SchemaService();
