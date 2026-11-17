async function test() {
  const region = "Benin City, Nigeria";
  const niche = "hotel";

  const geocodeRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(region)}&format=json&limit=1`, {
    headers: { 'User-Agent': 'TestApp/1.0' }
  });
  const geocodeData = await geocodeRes.json();
  const lat = parseFloat(geocodeData[0].lat);
  const lon = parseFloat(geocodeData[0].lon);

  const radius = 15000;
  const overpassQuery = `
    [out:json][timeout:25];
    (
      nwr["shop"~"${niche}",i](around:${radius},${lat},${lon});
      nwr["craft"~"${niche}",i](around:${radius},${lat},${lon});
      nwr["name"~"${niche}",i](around:${radius},${lat},${lon});
      nwr["amenity"~"${niche}",i](around:${radius},${lat},${lon});
      nwr["tourism"~"${niche}",i](around:${radius},${lat},${lon});
      nwr["leisure"~"${niche}",i](around:${radius},${lat},${lon});
    );
    out center 100;
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: "data=" + encodeURIComponent(overpassQuery)
  });
  
  if (!res.ok) {
     console.log("Error status:", res.status);
     console.log("Response:", await res.text());
     return;
  }
  const data = await res.json();
  console.log(`Found ${data.elements?.length || 0} results!`);
}
test();
