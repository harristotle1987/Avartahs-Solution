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
    throw new Error("Gemini API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this website: ${url}. Main business challenge: ${challenge}. Perform a forensic conversion audit.`,
    config: {
      systemInstruction: "You are a senior conversion rate optimization engineer and full-stack architect. Provide a high-density, forensic technical audit. Be critical and data-focused.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.STRING, description: "Letter grade from A to F" },
          revenueLeak: { type: Type.STRING, description: "Dollar amount or percentage of estimated lost revenue" },
          summary: { type: Type.STRING },
          bottleneck: { type: Type.STRING, description: "The primary technical or logic bottleneck" },
          uxFailure: { type: Type.STRING, description: "A specific UI/UX logic failure" },
          messagingFailure: { type: Type.STRING },
          immediateFix: { type: Type.STRING },
          shortTermFix: { type: Type.STRING },
          longTermFix: { type: Type.STRING }
        },
        required: ["score", "revenueLeak", "summary", "bottleneck", "uxFailure", "messagingFailure", "immediateFix", "shortTermFix", "longTermFix"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("AI failed to generate report.");
  
  return JSON.parse(text) as AuditReport;
};