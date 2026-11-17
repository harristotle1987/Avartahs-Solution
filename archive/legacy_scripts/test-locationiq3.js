async function test() {
  const query = encodeURIComponent("hotel, Benin City, Nigeria");
  const response = await fetch(`https://us1.locationiq.com/v1/search?key=${process.env.LOCATIONIQ_API_KEY}&q=${query}&format=json&addressdetails=1&extratags=1&limit=50`);
  if (!response.ok) {
     console.log("Error status:", response.status);
     console.log("Response:", await response.text());
     return;
  }
  const data = await response.json();
  console.log(`LocationIQ Found ${data.length || 0} results!`);
  if (data.length > 0) {
      console.log(data[0].display_name);
  }
}
test().catch(console.error);
