import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  if (!process.env.DATABASE_URL) {
    throw new Error('[Backend] DATABASE_URL environment variable is required.');
  }
  const sql = neon(process.env.DATABASE_URL);

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // API Routes for development
  app.get('/api/projects', async (req, res) => {
    try {
      const data = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const project = req.body;
      const mediaJson = JSON.stringify(project.media || []);
      await sql`
        INSERT INTO projects (id, title, description, media, tags, link, created_at)
        VALUES (${project.id}, ${project.title}, ${project.description}, ${mediaJson}::jsonb, ${project.tags}, ${project.link || null}, ${project.created_at})
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, media = EXCLUDED.media, tags = EXCLUDED.tags, link = EXCLUDED.link
      `;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save project' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      await sql`DELETE FROM projects WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  app.get('/api/leads', async (req, res) => {
    try {
      const data = await sql`SELECT * FROM audit_submissions ORDER BY created_at DESC`;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  app.post('/api/leads', async (req, res) => {
    try {
      const lead = req.body;
      await sql`
        INSERT INTO audit_submissions (id, session_id, target_url, user_email, user_phone, revenue_tier, core_problem, cta_source, status, created_at)
        VALUES (${lead.id}, ${lead.session_id}, ${lead.target_url}, ${lead.user_email}, ${lead.user_phone}, ${lead.revenue_tier}, ${lead.core_problem}, ${lead.cta_source}, ${lead.status}, ${lead.created_at})
      `;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save lead' });
    }
  });

  app.patch('/api/leads/:id', async (req, res) => {
    try {
      const { status, user_email, user_phone, target_url, revenue_tier } = req.body;
      await sql`
        UPDATE audit_submissions 
        SET user_email = COALESCE(${user_email || null}, user_email),
            user_phone = COALESCE(${user_phone || null}, user_phone),
            target_url = COALESCE(${target_url || null}, target_url),
            revenue_tier = COALESCE(${revenue_tier || null}, revenue_tier),
            status = COALESCE(${status || null}, status)
        WHERE id = ${req.params.id}
      `;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update lead' });
    }
  });

  app.delete('/api/leads/:id', async (req, res) => {
    try {
      await sql`DELETE FROM audit_submissions WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete lead' });
    }
  });

  app.get('/api/analytics', async (req, res) => {
    try {
      const data = await sql`SELECT * FROM site_analytics ORDER BY session_start DESC`;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  app.post('/api/bookings', async (req, res) => {
    try {
      const booking = req.body;
      await sql`
        INSERT INTO session_bookings (id, name, email, booking_date, booking_time, message, created_at)
        VALUES (${booking.id}, ${booking.name}, ${booking.email}, ${booking.booking_date}, ${booking.booking_time}, ${booking.message}, ${booking.created_at})
      `;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save booking' });
    }
  });

  app.get('/api/projects/count', async (req, res) => {
    try {
      const data = await sql`SELECT COUNT(*) FROM projects`;
      res.json(data[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to count projects' });
    }
  });

  app.get('/api/db-health', async (req, res) => {
    try {
      await sql`SELECT 1`;
      res.json({ status: 'connected' });
    } catch (error) {
      res.status(500).json({ status: 'disconnected', error });
    }
  });

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Backend] Dev Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
