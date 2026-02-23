import { supabase } from "../db/supabaseClient";

export class SQLGenerator {
  static async executeQuery(sqlQuery, params = {}) {
    try {
      // Parse the SQL-like query and convert to Supabase operations
      // This is a simplified version - in production, you'd want more robust parsing

      if (sqlQuery.includes(".select(")) {
        // Extract table name from query
        const tableMatch = sqlQuery.match(/from\('([^']+)'\)/);
        if (!tableMatch) throw new Error("Could not parse table name");

        const table = tableMatch[1];
        let query = supabase.from(table).select("*");

        // Apply filters
        const filters = sqlQuery.match(/\.eq\('([^']+)',\s*'?([^')]+)'?\)/g);
        if (filters) {
          filters.forEach((filter) => {
            const match = filter.match(/\.eq\('([^']+)',\s*'?([^')]+)'?\)/);
            if (match) {
              const [_, column, value] = match;
              query = query.eq(column, value.replace(/'/g, ""));
            }
          });
        }

        // Apply ordering
        if (sqlQuery.includes(".order(")) {
          const orderMatch = sqlQuery.match(
            /\.order\('([^']+)',\s*{ ascending: (true|false) }\)/
          );
          if (orderMatch) {
            const [_, column, ascending] = orderMatch;
            query = query.order(column, { ascending: ascending === "true" });
          }
        }

        // Apply single()
        if (sqlQuery.includes(".single()")) {
          query = query.single();
        }

        const { data, error } = await query;

        if (error) throw error;
        return { success: true, data };
      }

      // Handle insert operations for appointments
      if (sqlQuery.includes(".insert(")) {
        const insertMatch = sqlQuery.match(/\.insert\((\[.*\])\)/s);
        if (insertMatch) {
          const data = JSON.parse(insertMatch[1]);
          const tableMatch = sqlQuery.match(/from\('([^']+)'\)/);
          const table = tableMatch ? tableMatch[1] : "appointments";

          const { data: result, error } = await supabase
            .from(table)
            .insert(data)
            .select()
            .single();

          if (error) throw error;
          return { success: true, data: result };
        }
      }

      throw new Error("Unsupported query type");
    } catch (error) {
      console.error("Query Execution Error:", error);
      return { success: false, error: error.message };
    }
  }
}
