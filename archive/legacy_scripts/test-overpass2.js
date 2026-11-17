const niche = "plumber";
const region = "London";
const query = `
[out:json][timeout:25];
area["name"~"^${region}$",i]->.searchArea;
(
  nwr["shop"~"${niche}",i](area.searchArea);
  nwr["craft"~"${niche}",i](area.searchArea);
  nwr["name"~"${niche}",i](area.searchArea);
  nwr["amenity"~"${niche}",i](area.searchArea);
);
out center 20;
`;

fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'AvartahProspector/1.0 (contact@avartah.com)'
  },
  body: "data=" + encodeURIComponent(query)
}).then(res => {
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}).then(data => {
  const elements = data.elements || [];
  const filtered = elements.filter(e => !e.tags?.website && !e.tags?.['contact:website']);
  console.log(`Found ${elements.length} total, ${filtered.length} without websites`);
  console.log(filtered.slice(0,2));
}).catch(console.error);
