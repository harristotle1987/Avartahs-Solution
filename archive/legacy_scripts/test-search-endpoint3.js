async function test() {
  console.log("sending fetch...");
  const req = await fetch('http://localhost:3000/api/prospects/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ niche: 'hotels', region: 'Benin City, Nigeria' })
  });
  console.log("got response status:", req.status);
  const res = await req.json();
  console.log("got JSON with count:", res.count);
  process.exit(0);
}
test();
