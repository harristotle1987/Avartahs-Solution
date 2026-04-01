import { neon } from '@neondatabase/serverless';
import { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const data = await sql`SELECT COUNT(*) FROM projects`;
      res.json(data[0]);
    } catch (error) {
      console.error('[Backend] Failed to count projects:', error);
      res.status(500).json({ error: 'Failed to count projects' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
