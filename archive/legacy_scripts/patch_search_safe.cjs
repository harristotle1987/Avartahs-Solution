const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const startSig = `app.post('/api/prospects/search', async (req, res) => {`;
const endSig = `    } catch (err: any) {
      console.error('Search endpoint exception:', err);`;

const startIdx = code.indexOf(startSig);
const endIdx = code.indexOf(endSig, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const newEndpoint = `app.post('/api/prospects/search', async (req, res) => {
    try {
      const { region, niche } = req.body;
      
      let totalInsertedCount = 0;
      let usedSources: string[] = [];
      const insertedIds: string[] = [];

      // 1. PRIMARY: Gemini Google Search Grounding (Highly Accurate)
      if (process.env.GEMINI_API_KEY && totalInsertedCount < 49) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          
          const prompt = \`Search Google for "\${niche} in \${region}". 
Extract as many unique local businesses matching this query as you can find (aim for 40-50 if possible).
For each business, provide:
- name: The full business name
- location: The exact address or area in \${region}
- contact_info: The phone number (if available, otherwise "N/A")
- website_url: The website URL (if available, otherwise null)

Return ONLY a JSON array of objects with these exact keys.\`;

          console.log(\`[Search] Running Gemini Grounding for "\${niche}" in "\${region}"\`);
          const geminiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            tools: [{ googleSearch: {} }],
            config: { responseMimeType: 'application/json' }
          });
          
          let content = geminiResponse.text || '[]';
          content = content.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
          const parsed = JSON.parse(content);
          
          let insertedCount = 0;
          for (const business of parsed) {
             if (totalInsertedCount + insertedCount >= 49) break;
             const id = crypto.randomUUID();
             const bName = business.name || 'Unknown Business';
             const bLoc = business.location || region;
             const bContact = business.contact_info || 'N/A';
             const bWeb = business.website_url || null;
             
             await sql\`
                INSERT INTO prospects (id, business_name, location, contact_info, website_url, status)
                VALUES (\${id}, \${bName}, \${bLoc}, \${bContact}, \${bWeb}, 'Ready for Outreach')
                ON CONFLICT (id) DO NOTHING
             \`;
             insertedCount++;
          }
          if (insertedCount > 0) {
             usedSources.push('gemini-grounding');
             totalInsertedCount += insertedCount;
          }
        } catch (err: any) {
          console.warn("Gemini Grounding search warning:", err.message || err);
        }
      }

      // 2. FALLBACK: LocationIQ
      if (process.env.LOCATIONIQ_API_KEY && totalInsertedCount < 20) {
        try {
          let insertedCount = 0;
          const query = encodeURIComponent(\`\${niche} in \${region}\`);
          const response = await fetch(\`https://us1.locationiq.com/v1/search?key=\${process.env.LOCATIONIQ_API_KEY}&q=\${query}&format=json&addressdetails=1&extratags=1&limit=50\`);
          if (response.ok) {
            const places = await response.json();
            for (const place of places) {
              if (totalInsertedCount + insertedCount >= 49) break;
              const id = crypto.randomUUID();
              const businessName = place.name || place.display_name?.split(',')[0] || 'Unknown Business';
              const location = place.display_name || region;
              const contactInfo = place.extratags?.phone || place.extratags?.['contact:phone'] || 'N/A';
              const websiteUrl = place.extratags?.website || place.extratags?.['contact:website'] || place.extratags?.url || null;
              
              await sql\`
                INSERT INTO prospects (id, business_name, location, contact_info, website_url, status)
                VALUES (\${id}, \${businessName}, \${location}, \${contactInfo}, \${websiteUrl}, 'Ready for Outreach')
                ON CONFLICT (id) DO NOTHING
              \`;
              insertedCount++;
            }
          }
          if (insertedCount > 0) {
            usedSources.push('locationiq');
            totalInsertedCount += insertedCount;
          }
        } catch (locError) {
          console.error('LocationIQ Exception:', locError);
        }
      }

      // 3. FALLBACK: Nominatim
      if (totalInsertedCount < 20) {
        try {
          let insertedCount = 0;
          const query = encodeURIComponent(\`\${niche} in \${region}\`);
          const response = await fetch(\`https://nominatim.openstreetmap.org/search?q=\${query}&format=json&addressdetails=1&extratags=1&limit=50\`, {
            headers: { 'User-Agent': 'ProspectLocator/1.0' }
          });
          if (response.ok) {
            const places = await response.json();
            for (const place of places) {
              if (totalInsertedCount + insertedCount >= 49) break;
              const id = crypto.randomUUID();
              const businessName = place.name || place.display_name?.split(',')[0] || 'Unknown Business';
              const location = place.display_name || region;
              const contactInfo = place.extratags?.phone || place.extratags?.['contact:phone'] || 'N/A';
              const websiteUrl = place.extratags?.website || place.extratags?.['contact:website'] || place.extratags?.url || null;
              
              await sql\`
                INSERT INTO prospects (id, business_name, location, contact_info, website_url, status)
                VALUES (\${id}, \${businessName}, \${location}, \${contactInfo}, \${websiteUrl}, 'Ready for Outreach')
                ON CONFLICT (id) DO NOTHING
              \`;
              insertedCount++;
            }
          }
          if (insertedCount > 0) {
            usedSources.push('nominatim');
            totalInsertedCount += insertedCount;
          }
        } catch (nomError) {
          console.error('Nominatim Exception:', nomError);
        }
      }

      if (totalInsertedCount > 0) {
        return res.json({ success: true, count: totalInsertedCount, sources: usedSources });
      } else {
        return res.status(404).json({ error: 'No prospects found' });
      }
`;

    const newCode = code.substring(0, startIdx) + newEndpoint + code.substring(endIdx);
    fs.writeFileSync('server.ts', newCode);
    console.log("Successfully patched server.ts searchProspects");
} else {
    console.log("Failed to find endpoints");
    console.log("Start idx:", startIdx, "End idx:", endIdx);
}
