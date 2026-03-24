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

const app = express();
const PORT = 3000;

// Neon Connection
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Tqp0ojdvy4ZP@ep-wandering-salad-anmmi2ea-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
if (!process.env.DATABASE_URL) {
  console.warn('[Backend] DATABASE_URL is missing. Falling back to hardcoded connection string.');
}
const sql = neon(connectionString);

// Initialize database tables
async function initDb() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        media JSONB,
        tags TEXT[],
        link TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS audit_submissions (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        target_url TEXT,
        user_email TEXT,
        user_phone TEXT,
        revenue_tier TEXT,
        core_problem TEXT,
        cta_source TEXT,
        status TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS site_analytics (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        session_start TIMESTAMP WITH TIME ZONE,
        duration_seconds INTEGER,
        cta_clicks JSONB,
        whatsapp_handshake BOOLEAN,
        calendly_handshake BOOLEAN,
        submitted BOOLEAN
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS session_bookings (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        booking_date TEXT,
        booking_time TEXT,
        message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('[Backend] Database tables initialized successfully.');
  } catch (error) {
    console.error('[Backend] Failed to initialize database tables:', error);
  }
}

initDb();

// Middleware configuration
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Request Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/**
 * API ROUTES
 */

// Projects Proxy
app.get('/api/projects', async (req, res) => {
  try {
    const data = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
    res.json(data);
  } catch (error) {
    console.error('Neon Fetch Error (Projects):', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/projects', async (req, res) => {
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
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await sql`DELETE FROM projects WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    console.error('Neon Delete Error (Project):', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Leads Proxy
app.get('/api/leads', async (req, res) => {
  try {
    const data = await sql`SELECT * FROM audit_submissions ORDER BY created_at DESC`;
    res.json(data);
  } catch (error) {
    console.error('Neon Fetch Error (Leads):', error);
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
    console.error('Neon Save Error (Lead):', error);
    res.status(500).json({ error: 'Failed to save lead' });
  }
});

app.patch('/api/leads/:id', async (req, res) => {
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
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true });
  } catch (error) {
    console.error('Neon Update Error (Lead):', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

app.delete('/api/leads/:id', async (req, res) => {
  try {
    await sql`DELETE FROM audit_submissions WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    console.error('Neon Delete Error (Lead):', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Analytics Proxy
app.get('/api/analytics', async (req, res) => {
  try {
    const data = await sql`SELECT * FROM site_analytics ORDER BY session_start DESC`;
    res.json(data);
  } catch (error) {
    console.error('Neon Fetch Error (Analytics):', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Bookings Proxy
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = req.body;
    await sql`
      INSERT INTO session_bookings (id, name, email, booking_date, booking_time, message, created_at)
      VALUES (${booking.id}, ${booking.name}, ${booking.email}, ${booking.booking_date}, ${booking.booking_time}, ${booking.message}, ${booking.created_at})
    `;
    res.json({ success: true });
  } catch (error) {
    console.error('Neon Save Error (Booking):', error);
    res.status(500).json({ error: 'Failed to save booking' });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Avartah Solutions API Gateway is active',
    timestamp: new Date().toISOString()
  });
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
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Backend] Server running on http://0.0.0.0:${PORT}`);
});
