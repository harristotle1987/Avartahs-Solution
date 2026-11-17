async function run() {
  const logos = ["react", "postgresql", "supabase", "tailwindcss", "vercel"];
  const results = [];
  for (const q of logos) {
    const res = await fetch(`https://api.svgl.app?search=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.length > 0) results.push({ name: q, url: typeof data[0].route === "string" ? data[0].route : data[0].route.light, darkUrl: typeof data[0].route === "string" ? data[0].route : data[0].route.dark });
  }
  console.log(JSON.stringify(results, null, 2));
}
run();
