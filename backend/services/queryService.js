/**
 * Main query service - Simplified version
 */

import { supabase } from "../db/supabaseClient.js";
import geminiService from "./geminiService.js";
import { ERROR_MESSAGES } from "../config/constants.js";

class QueryService {
  async processQuery(question) {
    try {
      // Convert natural language to SQL
      const sqlQuery = await geminiService.naturalLanguageToSQL(question);

      // Execute the query
      const results = await this.executeQuery(sqlQuery);

      // Format response
      return this.formatResponse(results, question, sqlQuery);
    } catch (error) {
      console.error("Query processing error:", error);
      throw error;
    }
  }

  async executeQuery(sqlQuery) {
    try {
      if (process.env.NODE_ENV === "development") {
        console.log("Executing SQL:", sqlQuery);
      }

      const { data, error } = await supabase.rpc("exec_sql", {
        query_text: sqlQuery,
      });

      if (error) throw error;

      return {
        data: data || [],
        count: Array.isArray(data) ? data.length : 0,
      };
    } catch (error) {
      console.error("Query execution error:", error);
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }
  }

  formatResponse(results, question, sqlQuery) {
    const response = {
      success: true,
      question,
      data: results.data,
      metadata: {
        rowCount: results.count,
        timestamp: new Date().toISOString(),
      },
    };

    if (process.env.NODE_ENV === "development") {
      response.debug = { sql: sqlQuery };
    }

    if (results.count === 0) {
      response.message = "No results found";
    }

    return response;
  }
}

export default new QueryService();
