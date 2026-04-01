import { neon } from '@neondatabase/serverless';
import { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const data = await sql`SELECT * FROM site_analytics ORDER BY session_start DESC`;
      res.json(data);
    } catch (error) {
      console.error('Neon Fetch Error (Analytics):', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
