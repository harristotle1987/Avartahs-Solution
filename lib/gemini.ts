
import { GoogleGenAI, Type } from "@google/genai";

export interface AuditReport {
  score: string;
  revenueLeak: string;
  summary: string;
  bottleneck: string;
  uxFailure: string;
  messagingFailure: string;
  immediateFix: string;
  shortTermFix: string;
  longTermFix: string;
}

export const generateAuditReport = async (url: string, challenge: string): Promise<AuditReport> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_NOT_FOUND");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      // Upgrading to Pro for complex reasoning and forensic depth
      model: "gemini-3-pro-preview",
      contents: `Perform a deep conversion forensic audit for ${url}. Context: ${challenge}. Identify revenue leaks and UI/UX friction points.`,
      config: {
        systemInstruction: "You are a senior conversion engineer and revenue architect. Output a critical, high-fidelity audit in strict JSON format. Be blunt and data-driven.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.STRING, description: "Letter grade A-F" },
            revenueLeak: { type: Type.STRING, description: "Estimated monthly loss in USD" },
            summary: { type: Type.STRING },
            bottleneck: { type: Type.STRING },
            uxFailure: { type: Type.STRING },
            messagingFailure: { type: Type.STRING },
            immediateFix: { type: Type.STRING },
            shortTermFix: { type: Type.STRING },
            longTermFix: { type: Type.STRING }
          },
          required: ["score", "revenueLeak", "summary", "bottleneck", "uxFailure", "messagingFailure", "immediateFix", "shortTermFix", "longTermFix"]
        },
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    const cleanedJson = response.text.replace(/```json|```/g, "").trim();
    if (!cleanedJson) throw new Error("EMPTY_AI_RESPONSE");

    return JSON.parse(cleanedJson) as AuditReport;
  } catch (error) {
    console.error("Gemini Forensic Handshake Failed:", error);
    throw error;
  }
};
