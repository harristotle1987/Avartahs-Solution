async function test() {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Search Google for "hotels in Benin City, Nigeria". 
Extract as many unique local businesses matching this query as you can find (aim for 40-50 if possible).
For each business, provide:
- name: The full business name
- location: The exact address or area in Benin City
- contact_info: The phone number (if available, otherwise "N/A")
- website_url: The website URL (if available, otherwise null)

Return ONLY a JSON array of objects with these exact keys.`;

  const geminiResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    tools: [{ googleSearch: {} }],
    config: { responseMimeType: 'application/json' }
  });
  console.log("Response:", geminiResponse.text);
}
test().catch(console.error);
