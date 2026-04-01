import { neon } from '@neondatabase/serverless';
import { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (req.method === 'PATCH') {
    try {
      const { status, user_email, user_phone, target_url, revenue_tier } = req.body;
      await sql`
        UPDATE audit_submissions 
        SET 
          user_email = COALESCE(${user_email || null}, user_email),
          user_phone = COALESCE(${user_phone || null}, user_phone),
          target_url = COALESCE(${target_url || null}, target_url),
          revenue_tier = COALESCE(${revenue_tier || null}, revenue_tier),
          status = COALESCE(${status || null}, status)
        WHERE id = ${id as string}
      `;
      res.json({ success: true });
    } catch (error) {
      console.error('Neon Update Error (Lead):', error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  } else if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM audit_submissions WHERE id = ${id as string}`;
      res.json({ success: true });
    } catch (error) {
      console.error('Neon Delete Error (Lead):', error);
      res.status(500).json({ error: 'Failed to delete lead' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
