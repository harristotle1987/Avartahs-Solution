import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import pool from './neon.js';

export interface SessionData {
  id: string;
  userId?: number;
  email: string;
  role: string;
  createdAt: number;
  expiresAt: number;
}

export interface TenantMembership {
  tenantId: string;
  role: 'owner' | 'admin' | 'staff';
  memberEmail: string;
  isSuperAdmin?: boolean;
}

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const COOKIE_NAME = 'admin_session';

let cachedSessionSecret: string | null = process.env.SESSION_SECRET || null;

export async function getSessionSecret(): Promise<string> {
  if (cachedSessionSecret && cachedSessionSecret.length >= 32) {
    return cachedSessionSecret;
  }
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    cachedSessionSecret = process.env.SESSION_SECRET;
    return cachedSessionSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: A strong SESSION_SECRET (minimum 32 characters) must be configured in environment variables for production.');
  }
  try {
    const secretRes = await pool.query("SELECT value FROM system_settings WHERE key = 'SESSION_SECRET'");
    if (secretRes.rows.length > 0 && secretRes.rows[0].value?.length >= 32) {
      cachedSessionSecret = secretRes.rows[0].value;
    } else {
      const generatedSecret = crypto.randomBytes(32).toString('hex'); // 64 chars hex
      await pool.query(
        "INSERT INTO system_settings (key, value) VALUES ('SESSION_SECRET', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [generatedSecret]
      );
      const recheck = await pool.query("SELECT value FROM system_settings WHERE key = 'SESSION_SECRET'");
      cachedSessionSecret = recheck.rows.length > 0 ? recheck.rows[0].value : generatedSecret;
    }
  } catch (err: any) {
    console.error('[Session Secret Error]:', err.message || err);
    // Safe dev/test fallback meeting strict 256-bit requirement
    cachedSessionSecret = 'avartah_secure_dev_session_secret_key_32_characters_minimum_entropy';
  }
  return cachedSessionSecret || 'avartah_secure_dev_session_secret_key_32_characters_minimum_entropy';
}

export async function createSession(email: string, role: string = 'user', req?: Request): Promise<string> {
  const secret = await getSessionSecret();
  const sessionId = crypto.randomBytes(24).toString('hex');
  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_TTL_MS;
  const ip = req ? (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '' : '';
  const ua = (req?.headers['user-agent'] as string) || '';

  const payload = JSON.stringify({ sid: sessionId, email: email.toLowerCase().trim(), role, exp: expiresAt, iat: createdAt });
  const payloadB64 = Buffer.from(payload).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('hex');

  const fullToken = `${payloadB64}.${signature}`;
  const tokenHash = crypto.createHash('sha256').update(fullToken).digest('hex');

  // Enforce fail-closed persistent session store:
  // If the session record cannot be committed to the database, do not issue the session token.
  try {
    await pool.query(
      `INSERT INTO admin_sessions (id, user_email, user_role, created_at, expires_at, revoked, ip_address, user_agent, token_hash)
       VALUES ($1, $2, $3, TO_TIMESTAMP($4 / 1000.0), TO_TIMESTAMP($5 / 1000.0), FALSE, $6, $7, $8)`,
      [sessionId, email.toLowerCase().trim(), role, createdAt, expiresAt, ip, ua, tokenHash]
    );
  } catch (err: any) {
    console.error('[Session Store Error]: Failed to persist session in database:', err.message || err);
    throw new Error('Database authentication service unavailable: session creation failed closed.');
  }

  return fullToken;
}

export async function validateSession(token: string | undefined): Promise<SessionData | null> {
  if (!token || typeof token !== 'string') return null;
  const secret = await getSessionSecret();

  const parts = token.trim().split('.');
  if (parts.length < 2) return null;

  const [payloadB64, signature] = parts;
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expBuffer = Buffer.from(expectedSignature, 'hex');
    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || !payload.exp || Date.now() > payload.exp) {
      return null;
    }

    // Verify against database for revocation
    const sessionRes = await pool.query(
      'SELECT * FROM admin_sessions WHERE id = $1 AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP',
      [payload.sid]
    );
    if (sessionRes.rows.length === 0) {
      return null;
    }

    // Check admin_users first, then users table
    const adminRes = await pool.query(
      'SELECT id, email, role, is_active FROM admin_users WHERE LOWER(email) = LOWER($1)',
      [payload.email]
    );

    let activeUser = null;
    if (adminRes.rows.length > 0 && adminRes.rows[0].is_active) {
      activeUser = adminRes.rows[0];
    } else {
      const userRes = await pool.query(
        'SELECT id, email, role, is_active FROM users WHERE LOWER(email) = LOWER($1)',
        [payload.email]
      );
      if (userRes.rows.length > 0 && userRes.rows[0].is_active) {
        activeUser = userRes.rows[0];
      }
    }

    if (!activeUser) {
      return null;
    }

    return {
      id: payload.sid,
      userId: activeUser.id,
      email: activeUser.email,
      role: activeUser.role || payload.role || 'user',
      createdAt: payload.iat || (payload.exp - SESSION_TTL_MS),
      expiresAt: payload.exp
    };
  } catch {
    return null;
  }
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token || typeof token !== 'string') return;
  try {
    const parts = token.trim().split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (payload?.sid) {
        await pool.query('UPDATE admin_sessions SET revoked = TRUE WHERE id = $1', [payload.sid]);
      }
    }
  } catch (err: any) {
    console.warn('[Revoke Session Warning]:', err.message);
  }
}

/**
 * Express middleware to authenticate user via session cookie or Authorization header.
 * Attaches verified SessionData to `req.user`.
 */
export async function requireUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawToken = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!rawToken) {
    res.status(401).json({ error: 'Unauthorized: Authentication required. Please sign in.' });
    return;
  }

  const session = await validateSession(rawToken);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized: Session invalid or expired. Please sign in again.' });
    return;
  }

  (req as any).user = session;
  next();
}

/**
 * Express middleware to verify user is an active member or owner of the tenant with required role.
 * Enforces multi-tenant isolation and RBAC.
 */
export function requireTenantMembership(requiredRole?: 'owner' | 'admin' | 'staff') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user: SessionData = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      return;
    }

    const { tenantId } = req.params;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant identifier is required.' });
      return;
    }

    try {
      // 1. Fetch tenant
      const tenantRes = await pool.query(
        'SELECT id, name, business_name, owner_email, plan_id, status FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (tenantRes.rows.length === 0) {
        res.status(404).json({ error: 'Business organization not found.' });
        return;
      }

      const tenant = tenantRes.rows[0];

      // 2. Platform super admin bypass
      if (user.role === 'admin') {
        (req as any).tenantMembership = {
          tenantId,
          role: 'owner',
          memberEmail: user.email,
          isSuperAdmin: true
        };
        (req as any).tenant = tenant;
        return next();
      }

      // 3. Check if user is tenant owner directly
      const isDirectOwner = tenant.owner_email && tenant.owner_email.toLowerCase() === user.email.toLowerCase();

      // 4. Check tenant_members table
      const memberRes = await pool.query(
        'SELECT id, role, is_active FROM tenant_members WHERE tenant_id = $1 AND LOWER(user_email) = LOWER($2) AND is_active = TRUE',
        [tenantId, user.email]
      );

      let effectiveRole: 'owner' | 'admin' | 'staff' | null = null;
      if (isDirectOwner) {
        effectiveRole = 'owner';
      } else if (memberRes.rows.length > 0) {
        effectiveRole = memberRes.rows[0].role as 'owner' | 'admin' | 'staff';
      }

      if (!effectiveRole) {
        res.status(403).json({ error: 'Forbidden: You do not have access to this business organization.' });
        return;
      }

      // 5. Enforce minimum role hierarchy: owner > admin > staff
      if (requiredRole === 'owner' && effectiveRole !== 'owner') {
        res.status(403).json({ error: 'Forbidden: Business owner privileges required for this action.' });
        return;
      }

      if (requiredRole === 'admin' && effectiveRole !== 'owner' && effectiveRole !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Business administrator privileges required for this action.' });
        return;
      }

      (req as any).tenantMembership = {
        tenantId,
        role: effectiveRole,
        memberEmail: user.email,
        isSuperAdmin: false
      };
      (req as any).tenant = tenant;

      next();
    } catch (err: any) {
      console.error('[Tenant Authorization Error]:', err);
      res.status(500).json({ error: 'Failed to verify business authorization.' });
    }
  };
}

/**
 * Check plan limits before record insertion.
 */
export async function checkPlanLimits(
  tenantId: string | string[],
  limitType: 'customers' | 'catalog' | 'invoices' | 'staff'
): Promise<{ allowed: boolean; limit: number; current: number; error?: string }> {
  const tid = Array.isArray(tenantId) ? tenantId[0] : tenantId;
  const planRes = await pool.query(`
    SELECT t.plan_id, sp.name as plan_name, sp.max_customers, sp.max_catalog_items, sp.max_invoices_per_month, sp.max_staff_seats
    FROM tenants t
    LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
    WHERE t.id = $1
  `, [tid]);

  if (!planRes.rows.length) {
    return { allowed: false, limit: 0, current: 0, error: 'Tenant plan not found' };
  }

  const p = planRes.rows[0];

  if (limitType === 'customers') {
    const limit = Number(p.max_customers ?? 30);
    const countRes = await pool.query('SELECT COUNT(*)::int as count FROM customers WHERE tenant_id = $1', [tenantId]);
    const current = Number(countRes.rows[0]?.count ?? 0);
    if (current >= limit) {
      return {
        allowed: false,
        limit,
        current,
        error: `Plan limit reached: Your current plan (${p.plan_name || p.plan_id}) allows up to ${limit} customers. Upgrade your plan to add more.`
      };
    }
    return { allowed: true, limit, current };
  }

  if (limitType === 'catalog') {
    const limit = Number(p.max_catalog_items ?? 15);
    const countRes = await pool.query('SELECT COUNT(*)::int as count FROM catalog_items WHERE tenant_id = $1', [tenantId]);
    const current = Number(countRes.rows[0]?.count ?? 0);
    if (current >= limit) {
      return {
        allowed: false,
        limit,
        current,
        error: `Plan limit reached: Your current plan (${p.plan_name || p.plan_id}) allows up to ${limit} catalogue items. Upgrade to expand inventory.`
      };
    }
    return { allowed: true, limit, current };
  }

  if (limitType === 'invoices') {
    const limit = Number(p.max_invoices_per_month ?? 15);
    const countRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM invoices
      WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `, [tenantId]);
    const current = Number(countRes.rows[0]?.count ?? 0);
    if (current >= limit) {
      return {
        allowed: false,
        limit,
        current,
        error: `Monthly quota reached: Your plan allows up to ${limit} invoices/quotes per calendar month. Upgrade to continue issuing documents.`
      };
    }
    return { allowed: true, limit, current };
  }

  if (limitType === 'staff') {
    const limit = Number(p.max_staff_seats ?? 1);
    const countRes = await pool.query('SELECT COUNT(*)::int as count FROM tenant_members WHERE tenant_id = $1 AND is_active = TRUE', [tenantId]);
    const current = Number(countRes.rows[0]?.count ?? 0);
    if (limit < 999999 && current >= limit) {
      return {
        allowed: false,
        limit,
        current,
        error: `Staff seat limit reached: Your plan allows up to ${limit} team members. Upgrade to invite additional staff.`
      };
    }
    return { allowed: true, limit, current };
  }

  return { allowed: true, limit: 999999, current: 0 };
}

/**
 * Append immutable audit log for tenant actions.
 */
export async function logTenantAudit(
  tenantId: string | string[],
  userEmail: string,
  action: string,
  entityType: string,
  entityId: string | string[] | null,
  details: any = {}
): Promise<void> {
  try {
    const tid = Array.isArray(tenantId) ? tenantId[0] : tenantId;
    const eid = Array.isArray(entityId) ? entityId[0] : entityId;
    await pool.query(`
      INSERT INTO tenant_audit_logs (tenant_id, user_email, performed_by_email, action, entity_type, target_entity, entity_id, target_id, details)
      VALUES ($1, $2, $2, $3, $4, $4, $5, $5, $6)
    `, [tid, userEmail.toLowerCase(), action, entityType, eid, JSON.stringify(details)]);
  } catch (err: any) {
    console.warn('[Audit Log Warning]:', err.message);
  }
}
