async function test() {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `Search Google for "Hotels in Benin City, Nigeria". 
Extract as many unique hotels as you can find (aim for 20-40 if possible).
For each, provide:
- name
- location (address or area in Benin City)
- contact_info (phone number if available)
- website_url (if available)

Return ONLY a JSON array of objects with these exact keys.`;

  console.log("Generating with Gemini + Search Grounding...");
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    tools: [{ googleSearch: {} }],
    config: {
       responseMimeType: 'application/json'
    }
  });
  
  console.log("Result:", res.text);
}
test().catch(console.error);
