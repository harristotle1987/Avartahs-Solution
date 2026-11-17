const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const locateStartIndex = code.indexOf("app.post('/api/prospects/locate'");
const generateStartIndex = code.indexOf("app.post('/api/prospects/generate'");

if (locateStartIndex === -1 || generateStartIndex === -1) {
    console.error("Could not find start or end indices");
    process.exit(1);
}

const beforeLocate = code.substring(0, locateStartIndex);
const afterGenerate = code.substring(generateStartIndex);

const newEndpoints = `app.post('/api/prospects/locate', async (req, res) => {
    try {
      const { query, skipWebsites } = req.body;
      if (!query) return res.status(400).json({ error: 'Location or query is required' });

      let searchTerms: string[] = [];
      let clarificationMessage = null;

      if (process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
          });
          
          const aiPrompt = \`Parse this user query for finding business prospects: "\${query}".
Return a JSON object with:
- "queries": an array of exact search strings optimized for OpenStreetMap/Nominatim search.
To find more than 50 prospects, please generate 8 to 10 highly granular, localized search query variations targeting specific major neighborhoods, districts, streets, or local zones within the parsed location, combined with synonyms of the niche.

CRITICAL INSTRUCTIONS FOR MAP COMPATIBILITY:
1. Every query in the array MUST be formatted strictly as: "SingularNiche, Neighborhood, City, Region" (using commas for separation).
2. Use the SINGULAR form of the business type or niche. Plural words fail in Nominatim/OpenStreetMap searches.
3. Absolutely DO NOT include prepositions like "in", "at", or "of" inside the queries.
4. If the user query specifies a specific brand or local business name, treat that business name/brand as the niche.

- "needsClarification": boolean. Set to true ONLY if the location is completely missing, or just a country name with no city/state specified.
- "clarificationMessage": string. If needsClarification is true, a short polite message asking for a specific city or state. Otherwise empty string.\`;

          const geminiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: aiPrompt,
            config: {
              responseMimeType: 'application/json'
            }
          });
          
          let content = geminiResponse.text || '';
          content = content.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
          const parsed = JSON.parse(content);
          
          if (parsed.needsClarification) {
            clarificationMessage = parsed.clarificationMessage;
          } else {
            searchTerms = parsed.queries || [];
          }
        } catch (err: any) {
          console.warn("AI Parsing warning (e.g. rate limit/quota exceeded), falling back to simple split:", err.message || err);
        }
      }

      if (clarificationMessage) {
        return res.json({ success: true, clarificationRequired: true, message: clarificationMessage });
      }

      if (searchTerms.length === 0) {
        searchTerms = query.split(/[.;|\\n]/).map((s: string) => s.trim()).filter((s: string) => s.length > 2);
        if (searchTerms.length === 0 && query.length > 0) searchTerms.push(query);
      }

      let allResults: any[] = [];
      const usedIds = new Set();
      
      // Fallback directly to forwardGeocode since Google Maps is removed
      for (const finalQuery of searchTerms) {
        try {
          const results = await forwardGeocode(finalQuery);
          for (const result of results) {
             const resultId = result.id || crypto.randomUUID();
             if (usedIds.has(resultId)) continue;
             if (skipWebsites && result.map_url) continue; // Hacky mapping
             usedIds.add(resultId);
             
             allResults.push({
                id: resultId,
                name: result.name || result.label?.split(',')[0] || 'Unknown Business',
                label: result.label || '',
                latitude: result.latitude || 0,
                longitude: result.longitude || 0,
                phone: result.number || '',
                website: result.map_url || '',
                type: result.type || 'business',
                country: result.country || 'N/A'
             });
          }
        } catch (e) {
          console.error("Geocoding failed for", finalQuery, e);
        }
      }
      
      return res.json({ success: true, results: allResults, source: 'positionstack' });

    } catch (error: any) {
      console.error('Locate API Error:', error);
      res.status(500).json({ error: error.message || 'Search failed' });
    }
  });

  app.post('/api/prospects/search', async (req, res) => {
    try {
      const { region, niche } = req.body;
      
      const singularNiche = cleanAndSingularizeNiche(niche);
      let searchTerms: string[] = [
        \`\${singularNiche}, \${region}\`,
        \`\${niche}, \${region}\`
      ];

      if (process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
          });
          
          const aiPrompt = \`We are prospecting for "\${niche}" businesses in "\${region}".
To extract exactly 49 unique business prospects, automatically generate and execute 30 to 40 secondary searches using similar words, synonyms, and related industry terminology to broaden the net. Target specific major neighborhoods, districts, streets, or local zones within "\${region}", combined with synonyms of the niche. This guarantees the highest accuracy and relevance of the businesses found.

CRITICAL INSTRUCTIONS FOR MAP COMPATIBILITY:
1. Every query in the array MUST be formatted strictly as: "SingularNiche, Neighborhood, City, Region" (using commas for separation).
2. Use the SINGULAR form of the business type or niche (e.g., use "gym" instead of "gyms"). Plural words fail in searches.
3. Absolutely DO NOT include prepositions like "in", "at", or "of" inside the queries.
4. If "\${niche}" is a specific brand or local business name, treat that business name/brand as the niche.

Return a JSON object with:
- "queries": an array of exact search strings (e.g. ["dentist, Soho, London", "dental clinic, Kensington, London", ...]).\`;

          const geminiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: aiPrompt,
            config: {
              responseMimeType: 'application/json'
            }
          });
          
          let content = geminiResponse.text || '';
          content = content.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
          const parsed = JSON.parse(content);
          if (parsed.queries && parsed.queries.length > 0) {
            searchTerms = parsed.queries;
          }
        } catch (err: any) {
          console.warn("AI expansion warning for search:", err.message || err);
        }
      }

      let totalInsertedCount = 0;
      let usedSources: string[] = [];
      const insertedIds: string[] = [];

      // 1. Try APILayer (Positionstack) if key is present
      if ((process.env.APILAYER_API_KEY || process.env.POSITIONSTACK_API_KEY) && totalInsertedCount < 49) {
        try {
          let insertedCount = 0;
          for (const finalQuery of searchTerms) {
            if (totalInsertedCount + insertedCount >= 49) break;
            const results = await forwardGeocode(finalQuery);
            
            if (results && results.length > 0) {
              for (const result of results) {
                if (totalInsertedCount + insertedCount >= 49) break;
                const id = crypto.randomUUID();
                const businessName = result.name || result.label?.split(',')[0] || 'Unknown Business';
                const location = result.label || region;
                const contactInfo = \`Postal: \${result.postal_code || 'N/A'}\`;
                const websiteUrl = null; 
                
                await sql\`
                  INSERT INTO prospects (id, business_name, location, contact_info, website_url, status, ai_draft, email_draft, whatsapp_draft)
                  VALUES (\${id}, \${businessName}, \${location}, \${contactInfo}, \${websiteUrl}, 'Ready for Outreach', null, null, null)
                  ON CONFLICT (id) DO NOTHING
                \`;
                insertedIds.push(id);
                insertedCount++;
              }
            }
          }
          if (insertedCount > 0) {
            usedSources.push('positionstack');
            totalInsertedCount += insertedCount;
          }
        } catch (posError) {
          console.error('Positionstack Exception:', posError);
        }
      }

      // 2. Try APILayer (Serpstack) if key is present
      if (process.env.APILAYER_API_KEY && totalInsertedCount < 49) {
        try {
          let insertedCount = 0;
          for (const finalQuery of searchTerms) {
            if (totalInsertedCount + insertedCount >= 49) break;
            const query = encodeURIComponent(finalQuery);
            const apilayerResponse = await fetch(\`https://api.apilayer.net/serpstack/search?access_key=\${process.env.APILAYER_API_KEY}&query=\${query}&num=20\`);

            if (apilayerResponse.ok) {
              const data = await apilayerResponse.json();
              const organicResults = data.organic_results || [];
              
              for (const result of organicResults) {
                if (totalInsertedCount + insertedCount >= 49) break;
                const id = crypto.randomUUID();
                const businessName = result.title || 'Unknown Business';
                const location = result.displayed_url || region;
                const contactInfo = 'Check Website';
                const websiteUrl = result.url || null;
                
                await sql\`
                  INSERT INTO prospects (id, business_name, location, contact_info, website_url, status, ai_draft, email_draft, whatsapp_draft)
                  VALUES (\${id}, \${businessName}, \${location}, \${contactInfo}, \${websiteUrl}, 'Ready for Outreach', null, null, null)
                  ON CONFLICT (id) DO NOTHING
                \`;
                insertedIds.push(id);
                insertedCount++;
              }
            }
          }
          if (insertedCount > 0) {
            usedSources.push('apilayer');
            totalInsertedCount += insertedCount;
          }
        } catch (apilayerError) {
          console.error('APILayer Exception:', apilayerError);
        }
      }

      // 3. Try LocationIQ (OpenStreetMap) if key is present
      if (process.env.LOCATIONIQ_API_KEY && totalInsertedCount < 49) {
        try {
          let insertedCount = 0;
          for (const finalQuery of searchTerms) {
            if (totalInsertedCount + insertedCount >= 49) break;
            const query = encodeURIComponent(finalQuery);
            const response = await fetch(\`https://us1.locationiq.com/v1/search?key=\${process.env.LOCATIONIQ_API_KEY}&q=\${query}&format=json&addressdetails=1&extratags=1&limit=100\`);

            if (response.ok) {
              const places = await response.json();
              for (const place of places) {
                if (totalInsertedCount + insertedCount >= 49) break;
                const id = crypto.randomUUID();
                const businessName = place.name || place.display_name?.split(',')[0] || 'Unknown Business';
                const location = place.display_name || region;
                const contactInfo = place.extratags?.phone || place.extratags?.['contact:phone'] || 'No Phone Number';
                const websiteUrl = place.extratags?.website || place.extratags?.['contact:website'] || place.extratags?.url || null;
                
                await sql\`
                  INSERT INTO prospects (id, business_name, location, contact_info, website_url, status, ai_draft, email_draft, whatsapp_draft)
                  VALUES (\${id}, \${businessName}, \${location}, \${contactInfo}, \${websiteUrl}, 'Ready for Outreach', null, null, null)
                  ON CONFLICT (id) DO NOTHING
                \`;
                insertedIds.push(id);
                insertedCount++;
              }
            }
          }
          if (insertedCount > 0) {
            usedSources.push('locationiq');
            totalInsertedCount += insertedCount;
          }
        } catch (locationiqError) {
          console.error('LocationIQ API Error:', locationiqError);
        }
      }

      // 4. Ultimate Free Fallback to Nominatim (OpenStreetMap)
      if (totalInsertedCount < 49) {
        try {
          let insertedCount = 0;
          for (const finalQuery of searchTerms) {
            if (totalInsertedCount + insertedCount >= 49) break;
            const cleanedQuery = cleanQueryForNominatim(finalQuery);
            
            let places: any[] = [];
            let response = await fetch(\`https://nominatim.openstreetmap.org/search?q=\${encodeURIComponent(cleanedQuery)}&format=json&addressdetails=1&extratags=1&limit=100\`, {
              headers: { 'User-Agent': 'ProspectLocator/1.0' }
            });
            
            if (response.ok) {
              places = await response.json();
            }
            
            if (places.length === 0 && cleanedQuery !== finalQuery) {
              response = await fetch(\`https://nominatim.openstreetmap.org/search?q=\${encodeURIComponent(finalQuery)}&format=json&addressdetails=1&extratags=1&limit=100\`, {
                headers: { 'User-Agent': 'ProspectLocator/1.0' }
              });
              if (response.ok) {
                places = await response.json();
              }
            }
            
            for (const place of places) {
              if (totalInsertedCount + insertedCount >= 49) break;
              const id = crypto.randomUUID();
              const businessName = place.name || place.display_name?.split(',')[0] || 'Unknown Business';
              const location = place.display_name || region;
              const contactInfo = place.extratags?.phone || place.extratags?.['contact:phone'] || 'No Phone Number';
              const websiteUrl = place.extratags?.website || place.extratags?.['contact:website'] || place.extratags?.url || null;
              
              await sql\`
                INSERT INTO prospects (id, business_name, location, contact_info, website_url, status, ai_draft, email_draft, whatsapp_draft)
                VALUES (\${id}, \${businessName}, \${location}, \${contactInfo}, \${websiteUrl}, 'Ready for Outreach', null, null, null)
                ON CONFLICT (id) DO NOTHING
              \`;
              insertedIds.push(id);
              insertedCount++;
            }
          }
          
          if (insertedCount > 0) {
            usedSources.push('nominatim');
            totalInsertedCount += insertedCount;
          }
        } catch (nominatimErr) {
          console.error('[Search API] Nominatim places search failed:', nominatimErr);
        }
      }

      // Launch background enrichment synchronously
      if (insertedIds.length > 0) {
        await processProspectsBackground(insertedIds);
      }
      
      let prospectsData = [];
      if (insertedIds.length > 0) {
        const idList = insertedIds.map(id => \`'\${id}'\`).join(',');
        prospectsData = await sql.unsafe(\`SELECT * FROM prospects WHERE id IN (\${idList})\`);
      }
      res.json({ success: true, count: totalInsertedCount, source: usedSources.join(',') || 'none', data: prospectsData });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to search maps for prospects' });
    }
  });

  `;

code = beforeLocate + newEndpoints + afterGenerate;

fs.writeFileSync('server.ts', code);
console.log("Rewrote locate and search endpoints.");

