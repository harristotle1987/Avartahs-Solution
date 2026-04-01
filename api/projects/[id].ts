import { neon } from '@neondatabase/serverless';
import { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM projects WHERE id = ${id as string}`;
      res.json({ success: true });
    } catch (error) {
      console.error('Neon Delete Error (Project):', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
