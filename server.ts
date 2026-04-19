import express from 'express';
import cors from 'cors';
import compression from 'compression';
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

  // Database Schema Maintenance: Ensure all tables and constraints exist
  try {
    // 1. Analytics Table
    await sql`
      CREATE TABLE IF NOT EXISTS site_analytics (
        visitor_id TEXT PRIMARY KEY,
        session_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        duration_seconds INTEGER DEFAULT 0,
        cta_clicks JSONB DEFAULT '{}',
        form_progress INTEGER DEFAULT 0,
        submitted BOOLEAN DEFAULT FALSE,
        exit_page TEXT,
        step_durations JSONB DEFAULT '{}',
        is_pricing_sensitive BOOLEAN DEFAULT FALSE,
        whatsapp_handshake BOOLEAN DEFAULT FALSE,
        calendly_handshake BOOLEAN DEFAULT FALSE
      )
    `;

    // 2. Projects Table
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        media JSONB DEFAULT '[]',
        tags TEXT[],
        link TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 3. Leads (Audit Submissions)
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
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 4. Session Bookings
    await sql`
      CREATE TABLE IF NOT EXISTS session_bookings (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        booking_date TEXT,
        booking_time TEXT,
        message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 5. Admin Users
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Bootstrap Initial Admin
    await sql`
      INSERT INTO admin_users (email, password_hash) 
      VALUES ('admin@avartah.com', 'Colony082987@')
      ON CONFLICT (email) DO NOTHING
    `;
    
    console.log('[Backend] Database schema verified & fully provisioned.');
  } catch (e) {
    console.error('[Backend] Schema migration failure:', e);
  }

  app.use(compression()); // Enable Gzip compression
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Helper to set cache headers
  const setCacheControl = (res: express.Response, seconds: number = 3600) => {
    res.set('Cache-Control', `public, max-age=${seconds}`);
  };

  // Helper to handle and log DB connection errors (Firewall detection)
  const handleDbError = (res: express.Response, error: any, context: string) => {
    const isBlocked = error?.message?.includes('blocked network') || error?.stack?.includes('blocked network');
    console.error(`[DB Error - ${context}]:`, error.message || error);
    if (isBlocked) {
      console.error('>>> ACTION REQUIRED: Your Neon Database has IP Allowlisting enabled. <<<');
      console.error('>>> Please go to Neon Console -> Settings -> IP Allowlist and DISABLE it. <<<');
    }
    res.status(500).json({ 
      error: `Database error in ${context}`, 
      isIpBlocked: isBlocked,
      details: error.message 
    });
  };

  // API Routes for development
  app.get('/api/projects', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const data = await sql`
        SELECT id, title, description, media, tags, link, created_at 
        FROM projects 
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      setCacheControl(res, 600); // Cache for 10 minutes
      res.json(data);
    } catch (error) {
      handleDbError(res, error, 'projects:fetch');
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
      handleDbError(res, error, 'projects:save');
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
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const data = await sql`
        SELECT id, session_id, target_url, user_email, user_phone, revenue_tier, core_problem, cta_source, status, created_at 
        FROM audit_submissions 
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      setCacheControl(res, 60); // Cache for 1 minute
      res.json(data);
    } catch (error) {
      handleDbError(res, error, 'leads:fetch');
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
      handleDbError(res, error, 'leads:save');
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
      handleDbError(res, error, 'leads:update');
    }
  });

  app.delete('/api/leads/:id', async (req, res) => {
    try {
      await sql`DELETE FROM audit_submissions WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'leads:delete');
    }
  });

  app.get('/api/admin/summary', async (req, res) => {
    try {
      const analyticsRes = await sql`
        SELECT 
          COUNT(*) as total_visitors,
          COALESCE(AVG(duration_seconds), 0)::int as avg_duration,
          COUNT(*) FILTER (WHERE session_start >= NOW() - INTERVAL '7 days') as recent_visitors
        FROM site_analytics
      `;
      
      const revenueRes = await sql`
        SELECT 
          SUM(
            CASE 
              WHEN revenue_tier ILIKE '%ULTRA%' THEN 10000
              WHEN revenue_tier ILIKE '%PRO%' THEN 5000
              WHEN revenue_tier ILIKE '%GAMMA%' THEN 4000
              WHEN revenue_tier ILIKE '%BETA%' THEN 2000
              WHEN revenue_tier ILIKE '%ALPHA%' THEN 650
              ELSE 150
            END
          ) as projected_revenue
        FROM audit_submissions
        WHERE status != 'closed'
      `;
      
      res.json({
        analytics: analyticsRes[0],
        revenue: revenueRes[0].projected_revenue || 0
      });
    } catch (error) {
      handleDbError(res, error, 'summary:fetch');
    }
  });

  app.get('/api/analytics', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const data = await sql`
        SELECT visitor_id, session_start, duration_seconds, cta_clicks, form_progress, submitted, exit_page, is_pricing_sensitive, whatsapp_handshake, calendly_handshake 
        FROM site_analytics 
        ORDER BY session_start DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      setCacheControl(res, 60); // Cache leads and analytics briefly
      res.json(data);
    } catch (error) {
      handleDbError(res, error, 'analytics:fetch');
    }
  });

  app.post('/api/analytics/init', async (req, res) => {
    try {
      const session = req.body;
      await sql`
        INSERT INTO site_analytics (visitor_id, session_start, cta_clicks, form_progress, submitted, exit_page, is_pricing_sensitive)
        VALUES (${session.visitor_id}, ${session.session_start}, ${JSON.stringify(session.cta_clicks)}::jsonb, ${session.form_progress}, ${session.submitted}, ${session.exit_page}, false)
        ON CONFLICT (visitor_id) DO NOTHING
      `;
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'analytics:init');
    }
  });

  app.patch('/api/analytics/sync', async (req, res) => {
    try {
      const session = req.body;
      await sql`
        UPDATE site_analytics 
        SET 
          cta_clicks = ${JSON.stringify(session.cta_clicks)}::jsonb, 
          form_progress = ${session.form_progress},
          submitted = ${session.submitted},
          is_pricing_sensitive = ${session.is_pricing_sensitive},
          step_durations = ${JSON.stringify(session.step_durations)}::jsonb,
          whatsapp_handshake = ${session.whatsapp_handshake},
          calendly_handshake = ${session.calendly_handshake},
          duration_seconds = COALESCE(${session.duration_seconds}, duration_seconds),
          exit_page = COALESCE(${session.exit_page}, exit_page)
        WHERE visitor_id = ${session.visitor_id}
      `;
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, 'analytics:sync');
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { password } = req.body;
      const MASTER_PASSWORD = "Colony082987@";

      if (password === MASTER_PASSWORD) {
        return res.json({ success: true });
      }

      // Also check against Neon database if configured
      const users = await sql`SELECT * FROM admin_users WHERE email = 'admin@avartah.com' LIMIT 1`;
      if (users.length > 0) {
        if (users[0].password_hash === password) {
          return res.json({ success: true });
        }
      }
      res.status(401).json({ success: false });
    } catch (error) {
      res.status(500).json({ error: 'Auth Fault' });
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

  app.get('/api/analytics/count', async (req, res) => {
    try {
       const data = await sql`SELECT COUNT(*) as count FROM site_analytics`;
       res.json(data[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to count analytics' });
    }
  });

  app.get('/api/leads/count', async (req, res) => {
    try {
       const data = await sql`SELECT COUNT(*) as count FROM audit_submissions`;
       res.json(data[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to count leads' });
    }
  });

  app.get('/api/projects/count', async (req, res) => {
    try {
      const data = await sql`SELECT COUNT(*) as count FROM projects`;
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
      handleDbError(res, error, 'health-check');
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
