async function test() {
  const req = await fetch('http://localhost:3000/api/prospects/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ niche: 'hotels', region: 'Benin City, Nigeria' })
  });
  const res = await req.json();
  console.log(res);
}
test();
