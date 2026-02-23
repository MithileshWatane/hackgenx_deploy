import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export class GeminiService {
  constructor() {
    this.model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  }

  async generateSQLQuery(userQuery, tokenNumber = null) {
    try {
      const prompt = this.buildPrompt(userQuery, tokenNumber);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract SQL query from response
      return this.extractSQL(text);
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw new Error("Failed to generate SQL query");
    }
  }

  async generateNaturalLanguageResponse(data, userQuery) {
    try {
      const prompt = `
        User Query: ${userQuery}
        Database Results: ${JSON.stringify(data, null, 2)}
        
        Based on the database results above, provide a helpful and concise natural language response.
        If no data found, politely inform the user.
        Format the response in a user-friendly way.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "I apologize, but I encountered an error processing your request.";
    }
  }

  buildPrompt(userQuery, tokenNumber) {
    let prompt = APP_CONSTANTS.SYSTEM_PROMPT;

    if (tokenNumber) {
      prompt += `\n\nThe patient's token number is: ${tokenNumber}`;
    }

    prompt += `\n\nUser Query: ${userQuery}\nSQL:`;

    return prompt;
  }

  extractSQL(text) {
    // Extract SQL from markdown code blocks if present
    const sqlRegex = /```sql\n([\s\S]*?)\n```/;
    const match = text.match(sqlRegex);

    if (match) {
      return match[1].trim();
    }

    // If no code block, assume the whole response is SQL
    return text.trim();
  }
}
