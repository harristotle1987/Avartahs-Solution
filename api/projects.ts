import { neon } from '@neondatabase/serverless';
import { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const data = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
      res.json(data);
    } catch (error) {
      console.error('Neon Fetch Error (Projects):', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  } else if (req.method === 'POST') {
    try {
      const project = req.body;
      const mediaJson = JSON.stringify(project.media || []);
      
      await sql`
        INSERT INTO projects (id, title, description, media, tags, link, created_at)
        VALUES (
          ${project.id}, 
          ${project.title}, 
          ${project.description}, 
          ${mediaJson}::jsonb, 
          ${project.tags}, 
          ${project.link || null}, 
          ${project.created_at}
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          media = EXCLUDED.media,
          tags = EXCLUDED.tags,
          link = EXCLUDED.link
      `;
      res.json({ success: true });
    } catch (error) {
      console.error('Neon Save Error (Project):', error);
      res.status(500).json({ error: 'Failed to save project' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
