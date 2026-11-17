import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
async function run() {
  const data = await sql`SELECT * FROM prospects WHERE id = 'test-id'`;
  console.log(data);
  process.exit(0);
}
run();
