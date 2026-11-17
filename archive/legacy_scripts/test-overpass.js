const query = `
[out:json][timeout:25];
area["name"~"London",i]->.searchArea;
nwr["name"~"plumber",i](area.searchArea);
out center 10;
`;

fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: "data=" + encodeURIComponent(query)
}).then(res => res.json()).then(console.log).catch(console.error);
