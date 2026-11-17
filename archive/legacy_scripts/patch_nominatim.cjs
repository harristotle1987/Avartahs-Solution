const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const anchor = `      // Launch background enrichment synchronously
      if (insertedIds.length > 0) {
        await processProspectsBackground(insertedIds);
      }`;

const nominatimBlock = `
      // 3. FALLBACK: Nominatim (Free, No API Key Required)
      if (totalInsertedCount < 40) {
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
              
              // Skip generic matches without a specific name
              if (businessName.toLowerCase() === niche.toLowerCase()) continue;
              
              const location = place.display_name || region;
              const contactInfo = place.extratags?.phone || place.extratags?.['contact:phone'] || 'N/A';
              const websiteUrl = place.extratags?.website || place.extratags?.['contact:website'] || place.extratags?.url || null;
              
              await sql\`
                INSERT INTO prospects (id, business_name, location, contact_info, website_url, status)
                VALUES (\${id}, \${businessName}, \${location}, \${contactInfo}, \${websiteUrl}, 'Ready for Outreach')
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
        } catch (nomError) {
          console.error('Nominatim Exception:', nomError);
        }
      }

      // Launch background enrichment synchronously
      if (insertedIds.length > 0) {
        await processProspectsBackground(insertedIds);
      }
`;

code = code.replace(anchor, nominatimBlock);
fs.writeFileSync('server.ts', code);
console.log("Added Nominatim fallback.");
