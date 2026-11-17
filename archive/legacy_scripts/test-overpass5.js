async function test() {
  const region = "Benin City, Nigeria";
  const niche = "hotel";

  const lat = 6.3330586;
  const lon = 5.6221058;

  const radius = 15000;
  const overpassQuery = `[out:json][timeout:25];(nwr["shop"~"${niche}",i](around:${radius},${lat},${lon});nwr["craft"~"${niche}",i](around:${radius},${lat},${lon});nwr["name"~"${niche}",i](around:${radius},${lat},${lon});nwr["amenity"~"${niche}",i](around:${radius},${lat},${lon});nwr["tourism"~"${niche}",i](around:${radius},${lat},${lon});nwr["leisure"~"${niche}",i](around:${radius},${lat},${lon}););out center 50;`;

  const res = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery), {
     headers: { 'User-Agent': 'ProspectLocatorApp/1.0 (contact@prospectlocator.com)' }
  });
  
  if (!res.ok) {
     console.log("Error status:", res.status);
     console.log("Response:", await res.text());
     return;
  }
  const data = await res.json();
  console.log(`Found ${data.elements?.length || 0} results!`);
  if(data.elements.length > 0) {
     console.log(data.elements[1].tags);
  }
}
test();
