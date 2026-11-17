import pool from './neon.js';
import crypto from 'crypto';

export interface ServerlessRequest {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: any;
  method?: string;
}

export interface ServerlessResponse {
  status(code: number): ServerlessResponse;
  json(data: any): void;
}

export async function verifyServerlessAdmin(req: ServerlessRequest, res: ServerlessResponse): Promise<boolean> {
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (cookieHeader) {
    const match = cookieHeader.match(/admin_session=([^;]+)/);
    if (match) token = match[1].trim();
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return false;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    res.status(401).json({ error: 'Unauthorized: Invalid session token format' });
    return false;
  }

  try {
    const secretRes = await pool.query("SELECT value FROM system_settings WHERE key = 'SESSION_SECRET'");
    const sessionSecret = process.env.SESSION_SECRET || (secretRes.rows.length > 0 ? secretRes.rows[0].value : null);
    if (!sessionSecret) {
      res.status(500).json({ error: 'Server authentication configuration missing' });
      return false;
    }

    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', sessionSecret).update(payloadB64).digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).json({ error: 'Unauthorized: Invalid session signature' });
      return false;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || !payload.exp || Date.now() > payload.exp) {
      res.status(401).json({ error: 'Unauthorized: Session expired' });
      return false;
    }

    // Verify in persistent session database
    const sessionRes = await pool.query(
      'SELECT * FROM admin_sessions WHERE id = $1 AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP',
      [payload.sid]
    );
    if (sessionRes.rows.length === 0) {
      res.status(401).json({ error: 'Unauthorized: Session revoked or not found' });
      return false;
    }

    // Verify admin role
    const adminRes = await pool.query(
      'SELECT id, role, is_active FROM admin_users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE',
      [payload.email]
    );
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Administrator privileges required' });
      return false;
    }

    return true;
  } catch {
    res.status(401).json({ error: 'Unauthorized: Session validation failed' });
    return false;
  }
}
