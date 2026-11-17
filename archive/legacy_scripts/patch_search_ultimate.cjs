const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const startSig = `app.post('/api/prospects/search', async (req, res) => {`;
const endSig = `  app.post('/api/prospects/generate', async (req, res) => {`;

const startIdx = code.indexOf(startSig);
const endIdx = code.indexOf(endSig, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const newEndpoint = `app.post('/api/prospects/search', async (req, res) => {
    try {
      const { region, niche } = req.body;
      
      let usedSources = new Set<string>();
      const insertedIds: string[] = [];
      const MAX_PROSPECTS = 50;

      let searchQueries = [\`\${niche} in \${region}\`];
      
      // 1. Expand Search Queries using Gemini if available
      let ai;
      if (process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          
          const expansionPrompt = \`Generate 3 distinct, highly relevant search queries to find "\${niche}" businesses in "\${region}".
Return ONLY a JSON array of strings (e.g. ["hospitals in Port Harcourt", "medical clinics in Port Harcourt", "healthcare centers in Port Harcourt"]).\`;
          
          const expResponse = await ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: expansionPrompt,
             config: { responseMimeType: 'application/json' }
          });
          let content = expResponse.text || '[]';
          content = content.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed.length > 0) {
             searchQueries = parsed.slice(0, 3); // limit to top 3 variations
          }
        } catch (err) {
          console.warn("Query expansion failed, using default.");
        }
      }

      const allProspectsMap = new Map();
      const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Combine fetches to run in parallel
      const fetchPromises = [];

      // A. Gemini Grounding Tasks
      if (ai) {
        for (const query of searchQueries) {
          fetchPromises.push((async () => {
             try {
                const prompt = \`Search Google for "\${query}". 
Extract local businesses matching this query.
For each business, provide:
- name: The full business name
- location: The exact address or area
- contact_info: The phone number (if available, otherwise "N/A")
- website_url: The website URL (if available, otherwise null)
Return ONLY a JSON array of objects with these exact keys.\`;
                
                const response = await ai.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: prompt,
                  tools: [{ googleSearch: {} }],
                  config: { responseMimeType: 'application/json' }
                });
                
                let text = (response.text || '[]').replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
                const items = JSON.parse(text);
                for (const item of items) {
                   if (item.name) {
                     const key = normalize(item.name);
                     if (!allProspectsMap.has(key)) {
                        allProspectsMap.set(key, { ...item, source: 'gemini-grounding' });
                     }
                   }
                }
             } catch (err) {
                console.warn("Gemini Grounding error for", query);
             }
          })());
        }
      }

      // B. LocationIQ Tasks
      if (process.env.LOCATIONIQ_API_KEY) {
        for (const query of searchQueries) {
          fetchPromises.push((async () => {
             try {
                const encQuery = encodeURIComponent(query);
                const res = await fetch(\`https://us1.locationiq.com/v1/search?key=\${process.env.LOCATIONIQ_API_KEY}&q=\${encQuery}&format=json&addressdetails=1&extratags=1&limit=50\`);
                if (res.ok) {
                   const items = await res.json();
                   for (const place of items) {
                      const name = place.name || place.display_name?.split(',')[0];
                      if (name && name.toLowerCase() !== niche.toLowerCase()) {
                         const key = normalize(name);
                         if (!allProspectsMap.has(key)) {
                            allProspectsMap.set(key, {
                               name,
                               location: place.display_name || region,
                               contact_info: place.extratags?.phone || place.extratags?.['contact:phone'] || 'N/A',
                               website_url: place.extratags?.website || place.extratags?.['contact:website'] || place.extratags?.url || null,
                               source: 'locationiq'
                            });
                         }
                      }
                   }
                }
             } catch (err) {
                console.warn("LocationIQ error for", query);
             }
          })());
        }
      }

      // C. Nominatim Tasks (Free Fallback)
      for (const query of searchQueries) {
        fetchPromises.push((async () => {
           try {
              const encQuery = encodeURIComponent(query);
              const res = await fetch(\`https://nominatim.openstreetmap.org/search?q=\${encQuery}&format=json&addressdetails=1&extratags=1&limit=50\`, {
                 headers: { 'User-Agent': 'ProspectLocator/1.0' }
              });
              if (res.ok) {
                 const items = await res.json();
                 for (const place of items) {
                    const name = place.name || place.display_name?.split(',')[0];
                    if (name && name.toLowerCase() !== niche.toLowerCase()) {
                       const key = normalize(name);
                       if (!allProspectsMap.has(key)) {
                          allProspectsMap.set(key, {
                             name,
                             location: place.display_name || region,
                             contact_info: place.extratags?.phone || place.extratags?.['contact:phone'] || 'N/A',
                             website_url: place.extratags?.website || place.extratags?.['contact:website'] || place.extratags?.url || null,
                             source: 'nominatim'
                          });
                       }
                    }
                 }
              }
           } catch (err) {
              console.warn("Nominatim error for", query);
           }
        })());
      }

      // Wait for all fetches to complete
      await Promise.all(fetchPromises);

      // Collect all prospects, limit to MAX_PROSPECTS
      const uniqueProspects = Array.from(allProspectsMap.values()).slice(0, MAX_PROSPECTS);
      
      // Batch Insert into DB
      for (const p of uniqueProspects) {
         const id = crypto.randomUUID();
         const bName = p.name || 'Unknown Business';
         const bLoc = p.location || region;
         const bContact = p.contact_info || 'N/A';
         const bWeb = p.website_url || null;
         usedSources.add(p.source);
         
         await sql\`
            INSERT INTO prospects (id, business_name, location, contact_info, website_url, status)
            VALUES (\${id}, \${bName}, \${bLoc}, \${bContact}, \${bWeb}, 'Ready for Outreach')
            ON CONFLICT (id) DO NOTHING
         \`;
         insertedIds.push(id);
      }

      // Launch background enrichment ASYNCHRONOUSLY
      if (insertedIds.length > 0) {
        processProspectsBackground(insertedIds).catch(err => {
          console.error("Background enrichment failed:", err);
        });
      }

      let prospectsData = [];
      if (insertedIds.length > 0) {
        prospectsData = await sql\`SELECT * FROM prospects WHERE id = ANY(\${insertedIds})\`;
      }

      res.json({ 
        success: true, 
        count: insertedIds.length, 
        source: Array.from(usedSources).join(',') || 'none', 
        data: prospectsData 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to search maps for prospects' });
    }
  });
`;

    const newCode = code.substring(0, startIdx) + newEndpoint + code.substring(endIdx);
    fs.writeFileSync('server.ts', newCode);
    console.log("Successfully patched server.ts searchProspects with parallel aggregator.");
} else {
    console.log("Failed to find endpoints");
    console.log("Start idx:", startIdx, "End idx:", endIdx);
}
