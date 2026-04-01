import { neon } from '@neondatabase/serverless';
import { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await sql`SELECT 1`;
    res.json({ status: 'connected' });
  } catch (error) {
    console.error('[Backend] Database health check failed:', error);
    res.status(500).json({ status: 'disconnected', error });
  }
}
