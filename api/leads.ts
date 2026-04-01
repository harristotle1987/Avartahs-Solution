import { neon } from '@neondatabase/serverless';
import { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const data = await sql`SELECT * FROM audit_submissions ORDER BY created_at DESC`;
      res.json(data);
    } catch (error) {
      console.error('Neon Fetch Error (Leads):', error);
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  } else if (req.method === 'POST') {
    try {
      const lead = req.body;
      await sql`
        INSERT INTO audit_submissions (id, session_id, target_url, user_email, user_phone, revenue_tier, core_problem, cta_source, status, created_at)
        VALUES (${lead.id}, ${lead.session_id}, ${lead.target_url}, ${lead.user_email}, ${lead.user_phone}, ${lead.revenue_tier}, ${lead.core_problem}, ${lead.cta_source}, ${lead.status}, ${lead.created_at})
      `;
      res.json({ success: true });
    } catch (error) {
      console.error('Neon Save Error (Lead):', error);
      res.status(500).json({ error: 'Failed to save lead' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
