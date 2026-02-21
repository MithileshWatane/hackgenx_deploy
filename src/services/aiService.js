const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY;
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/**
 * Analyzes a medical report (image or PDF) using Groq AI.
 * @param {string} fileUrl - The public URL of the file in Supabase storage.
 * @param {string} reportType - The type of report (blood, xray, scan, etc.)
 * @returns {Promise<{summary: string}>}
 */
export async function analyzeMedicalReport(fileUrl, reportType) {
    if (!GROQ_API_KEY) {
        console.error("Groq API key not configured.");
        return { summary: "AI summary unavailable (API key missing)." };
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a medical assistant AI. Analyze the provided medical report and provide a concise, 2-line summary of key insights. Be professional and accurate.'
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Analyze this ${reportType} report and summarize the findings in exactly 2 lines.`
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: fileUrl
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.2,
                max_tokens: 150
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("Groq AI Error:", error);
            throw new Error("Failed to analyze report");
        }

        const data = await response.json();
        const summary = data.choices[0]?.message?.content || "No summary generated.";

        return {
            summary: summary.trim()
        };
    } catch (err) {
        console.error("AI Analysis failed:", err);
        return {
            summary: "Error during AI analysis. Manual review required."
        };
    }
}
