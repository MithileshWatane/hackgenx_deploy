import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function test() {
  try {
    const result = await model.generateContent("Say hello in one word");
    const response = await result.response;
    console.log("✅ Gemini API working:", response.text());
  } catch (error) {
    console.error("❌ Gemini API error:", error.message);
  }
}

test();
