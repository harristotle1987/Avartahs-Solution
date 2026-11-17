import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../lib/neon.js';
import {
  requireUserAuth,
  requireTenantMembership,
  checkPlanLimits,
  logTenantAudit,
  SessionData
} from '../lib/serverAuth.js';
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
  validatePaystackModeAndKey,
  resolvePaystackCallbackUrl,
  getPaystackPaymentCurrency,
  isValidPaystackReference
} from '../lib/paystack.js';

export const businessOSRouter = Router();

function sendSafeRouterError(res: Response, err: any, context: string) {
  const ref = 'oserr_' + crypto.randomBytes(6).toString('hex');
  const rawMsg = typeof err === 'string' ? err : (err?.message || String(err));
  const sanitizedLog = rawMsg
    .replace(/(sk_(?:test|live)_[A-Za-z0-9]+)/gi, '[REDACTED_PAYSTACK_KEY]')
    .replace(/(pk_(?:test|live)_[A-Za-z0-9]+)/gi, '[REDACTED_PUBLIC_KEY]')
    .replace(/(password|secret|key|token|bearer|authorization)=?[^\s&]+/gi, '$1=[REDACTED]')
    .replace(/[a-zA-Z0-9_\-\.\/]+@[a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  console.error(`[BusinessOS Error ${ref} - ${context}]:`, sanitizedLog);
  return res.status(500).json({
    error: 'An unexpected server error occurred. Please try again later.',
    ref
  });
}

// Lightweight sliding-window rate limiter for interactive payment endpoints (excludes webhook so Paystack retries are never dropped)
const paymentRateBuckets = new Map<string, { count: number; resetAt: number }>();
function paymentRateLimit(bucketPrefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: any) => {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.socket?.remoteAddress || req.ip || '127.0.0.1';
    const actor = (req as any).user?.email || ip;
    const key = `${bucketPrefix}:${actor}:${ip}`;
    const now = Date.now();
    const current = paymentRateBuckets.get(key);

    if (!current || current.resetAt <= now) {
      paymentRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many payment requests. Please wait a moment and try again.'
      });
    }
    return next();
  };
}

// Helper to sanitize slug
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Industry Catalog Presets for Instant Seeding
const INDUSTRY_PRESETS: Record<string, { customer_label: string; catalog_label: string; items: { title: string; category: string; unit_price: number; type: 'service' | 'product'; description: string }[] }> = {
  salon: {
    customer_label: 'Client',
    catalog_label: 'Treatments & Services',
    items: [
      { title: 'Hydrafacial Cleanse', category: 'Facials', unit_price: 35000, type: 'service', description: 'Deep pore extraction and serum hydration' },
      { title: 'Executive Haircut & Styling', category: 'Hair', unit_price: 15000, type: 'service', description: 'Precision styling, wash and finish' },
      { title: 'Luxury Pedicure & Manicure', category: 'Nails', unit_price: 22000, type: 'service', description: 'Exfoliation, massage, and gel polish' },
      { title: 'Hair Repair Mask 250ml', category: 'Retail Products', unit_price: 18000, type: 'product', description: 'Organic keratin deep conditioning mask' }
    ]
  },
  restaurant: {
    customer_label: 'Guest / Diner',
    catalog_label: 'Menu & Beverages',
    items: [
      { title: 'Chef Special Jollof Feast', category: 'Mains', unit_price: 8500, type: 'product', description: 'Smoky firewood jollof with grilled jumbo prawns and plantain' },
      { title: 'Suya Spiced Lamb Chops', category: 'Grills', unit_price: 16500, type: 'product', description: 'Tender lamb chops with house yaji blend' },
      { title: 'Artisan Hibiscus Mocktail', category: 'Beverages', unit_price: 4500, type: 'product', description: 'Fresh zobo reduction with cloves and sparkling tonic' },
      { title: 'Private Dining Room Booking (2 hrs)', category: 'Events', unit_price: 50000, type: 'service', description: 'Exclusive VIP room reservation with dedicated host' }
    ]
  },
  retail: {
    customer_label: 'Customer',
    catalog_label: 'Inventory & Merchandise',
    items: [
      { title: 'Italian Leather Crossbody Bag', category: 'Accessories', unit_price: 45000, type: 'product', description: 'Handcrafted full-grain leather handbag' },
      { title: 'Classic Tailored Oxford Shirt', category: 'Apparel', unit_price: 25000, type: 'product', description: '100% premium Egyptian cotton' },
      { title: 'Personal Styling Consultation', category: 'Services', unit_price: 30000, type: 'service', description: '1-on-1 wardrobe and color matching session' }
    ]
  },
  consulting: {
    customer_label: 'Client',
    catalog_label: 'Consulting Advisory',
    items: [
      { title: 'Strategic Business Audit', category: 'Strategy', unit_price: 250000, type: 'service', description: 'Comprehensive diagnostic of operations and market fit' },
      { title: 'Tax & Compliance Review', category: 'Finance', unit_price: 180000, type: 'service', description: 'Assessment of corporate filings, VAT, and CIT liability' },
      { title: 'Monthly Executive Retainer', category: 'Retainer', unit_price: 400000, type: 'service', description: 'Bi-weekly advisory calls and executive documentation' }
    ]
  },
  legal: {
    customer_label: 'Client',
    catalog_label: 'Legal Practices',
    items: [
      { title: 'Commercial Contract Drafting & Review', category: 'Corporate', unit_price: 150000, type: 'service', description: 'NDA, service agreements, and shareholder terms' },
      { title: 'CAC Corporate Filing & Registration', category: 'Regulatory', unit_price: 85000, type: 'service', description: 'Post-incorporation filings, annual returns, status reports' },
      { title: 'Hourly Litigation Retainer', category: 'Dispute', unit_price: 60000, type: 'service', description: 'Court appearance and dispute arbitration representation' }
    ]
  },
  furniture: {
    customer_label: 'Client / Buyer',
    catalog_label: 'Showroom Catalog',
    items: [
      { title: 'Scandinavian 3-Seater Sofa', category: 'Living Room', unit_price: 380000, type: 'product', description: 'Stain-resistant bouclé fabric with solid oak legs' },
      { title: 'Handcrafted Teak Dining Table (6-seater)', category: 'Dining Room', unit_price: 450000, type: 'product', description: 'Reclaimed teak wood with matte protective sealant' },
      { title: 'Custom Interior Space Measurement & 3D Render', category: 'Design', unit_price: 75000, type: 'service', description: 'Architectural space planning and layout optimization' }
    ]
  },
  automotive: {
    customer_label: 'Vehicle Owner',
    catalog_label: 'Repairs & Spare Parts',
    items: [
      { title: 'Comprehensive Diagnostic Computer Scan', category: 'Diagnostics', unit_price: 20000, type: 'service', description: 'OBD-II full electronic and sensor trouble code analysis' },
      { title: 'Full Synthetic Engine Oil Service', category: 'Maintenance', unit_price: 48000, type: 'service', description: 'Premium 5W-30 oil change, OEM filter and 21-point check' },
      { title: 'Ceramic Brake Pads Replacement', category: 'Brakes', unit_price: 35000, type: 'product', description: 'Low dust, high friction heat-resistant brake pads' }
    ]
  },
  other: {
    customer_label: 'Customer',
    catalog_label: 'Products & Services',
    items: [
      { title: 'Standard Service Package', category: 'General', unit_price: 50000, type: 'service', description: 'Core business service delivery' },
      { title: 'Premium Service Package', category: 'General', unit_price: 120000, type: 'service', description: 'Comprehensive expedited service offering' }
    ]
  }
};

// 1. GET /api/os/plans (Public)
businessOSRouter.get('/plans', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY price_ngn ASC');
    res.json(rows);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 2. GET /api/os/tenants (List tenants user belongs to, strictly verified from server session)
businessOSRouter.get('/tenants', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const user: SessionData = (req as any).user;

    let query: string;
    let params: any[];

    if (user.role === 'admin') {
      // Platform Super Admin sees all tenants
      query = `
        SELECT t.*, 
               COALESCE(t.name, t.business_name, 'Business') as name,
               COALESCE(t.business_name, t.name, 'Business') as business_name,
               ts.customer_label, ts.catalog_label, ts.invoice_prefix, ts.tax_rate_percentage, sp.name as plan_name
        FROM tenants t
        LEFT JOIN tenant_settings ts ON t.id = ts.tenant_id
        LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
        ORDER BY t.created_at DESC
      `;
      params = [];
    } else {
      // Normal users only see businesses they own or belong to as active members
      query = `
        SELECT DISTINCT t.*, 
               COALESCE(t.name, t.business_name, 'Business') as name,
               COALESCE(t.business_name, t.name, 'Business') as business_name,
               ts.customer_label, ts.catalog_label, ts.invoice_prefix, ts.tax_rate_percentage, sp.name as plan_name
        FROM tenants t
        LEFT JOIN tenant_settings ts ON t.id = ts.tenant_id
        LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
        LEFT JOIN tenant_members tm ON t.id = tm.tenant_id AND LOWER(tm.user_email) = LOWER($1) AND tm.is_active = TRUE
        WHERE LOWER(t.owner_email) = LOWER($1) OR tm.id IS NOT NULL
        ORDER BY t.created_at DESC
      `;
      params = [user.email];
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 3. POST /api/os/register (Create new business - authenticated user becomes owner)
businessOSRouter.post('/register', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const user: SessionData = (req as any).user;
    const { name, industry, phone, country = 'NG', currency = 'NGN', plan_id = 'free' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    // Owner email is strictly bound to authenticated session identity
    const ownerEmail = user.email.toLowerCase().trim();

    const tenantId = `biz_${crypto.randomUUID().slice(0, 8)}`;
    const baseSlug = slugify(name);
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 4)}`;

    const selectedIndustry = industry || 'other';
    const preset = INDUSTRY_PRESETS[selectedIndustry] || INDUSTRY_PRESETS.other;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Security Hardening: New business registration is strictly initialized on the 'free' plan.
      // Paid tiers (starter, growth, pro) require verified Paystack checkout before activation.
      const initialPlanId = 'free';

      // Insert tenant
      const tenantRes = await client.query(`
        INSERT INTO tenants (id, name, business_name, slug, industry, owner_email, phone, email, country, currency, timezone, plan_id, status)
        VALUES ($1, $2, $2, $3, $4, $5, $6, $5, $7, $8, 'Africa/Lagos', $9, 'ACTIVE')
        RETURNING *
      `, [tenantId, name.trim(), slug, selectedIndustry, ownerEmail, phone || null, country, currency, initialPlanId]);

      // Insert tenant_settings with industry presets
      await client.query(`
        INSERT INTO tenant_settings (tenant_id, customer_label, catalog_label, invoice_prefix, quotation_prefix, tax_rate_percentage, receipt_footer_note)
        VALUES ($1, $2, $3, 'INV', 'QTE', 7.5, 'Thank you for your valued business!')
      `, [tenantId, preset.customer_label, preset.catalog_label]);

      // Insert owner into tenant_members
      await client.query(`
        INSERT INTO tenant_members (id, tenant_id, user_email, role, name, phone, is_active)
        VALUES ($1, $2, $3, 'owner', $4, $5, TRUE)
      `, [`tm_${crypto.randomUUID().slice(0, 8)}`, tenantId, ownerEmail, name.trim(), phone || null]);

      // Insert subscription record for free tier
      await client.query(`
        INSERT INTO subscriptions (id, tenant_id, plan_id, status, user_email)
        VALUES ($1, $2, $3, 'active', $4)
      `, [`sub_${crypto.randomUUID().slice(0, 8)}`, tenantId, initialPlanId, ownerEmail]);

      // Seed initial catalog items from preset
      for (const item of preset.items) {
        await client.query(`
          INSERT INTO catalog_items (id, tenant_id, title, description, type, category, unit_price, cost_price, sku, stock_quantity, track_inventory, is_available)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, 25, FALSE, TRUE)
        `, [`cat_${crypto.randomUUID().slice(0, 8)}`, tenantId, item.title, item.description, item.type, item.category, item.unit_price, `SKU-${crypto.randomUUID().slice(0, 5).toUpperCase()}`]);
      }

      await client.query('COMMIT');

      await logTenantAudit(tenantId, ownerEmail, 'REGISTER_BUSINESS', 'tenant', tenantId, { name, plan_id });

      res.status(201).json({
        tenant: tenantRes.rows[0],
        redirect: `/business-os/onboarding?tenant=${tenantId}`
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 4. GET /api/os/tenants/:tenantId
businessOSRouter.get('/tenants/:tenantId', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { rows } = await pool.query(`
      SELECT t.*,
             COALESCE(t.name, t.business_name, 'Business') as name,
             COALESCE(t.business_name, t.name, 'Business') as business_name,
             row_to_json(ts) as settings,
             row_to_json(sp) as plan
      FROM tenants t
      LEFT JOIN tenant_settings ts ON t.id = ts.tenant_id
      LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
      WHERE t.id = $1
    `, [tenantId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 5. PATCH /api/os/tenants/:tenantId (Owner only)
businessOSRouter.patch('/tenants/:tenantId', requireUserAuth, requireTenantMembership('owner'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { name, phone, email, address, city, state, currency, timezone, logo_url } = req.body;
    const user: SessionData = (req as any).user;

    const { rows } = await pool.query(`
      UPDATE tenants
      SET name = COALESCE($1, name),
          business_name = COALESCE($1, business_name, name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          address = COALESCE($4, address),
          city = COALESCE($5, city),
          state = COALESCE($6, state),
          currency = COALESCE($7, currency),
          timezone = COALESCE($8, timezone),
          logo_url = COALESCE($9, logo_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [name, phone, email, address, city, state, currency, timezone, logo_url, tenantId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await logTenantAudit(tenantId, user.email, 'UPDATE_PROFILE', 'tenant', tenantId, { name, currency });

    res.json(rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 5b. PATCH /api/os/:tenantId/profile (Owner only - route alias)
businessOSRouter.patch('/:tenantId/profile', requireUserAuth, requireTenantMembership('owner'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { name, business_name, phone, email, address, city, state, currency, timezone, logo_url } = req.body;
    const user: SessionData = (req as any).user;
    const effectiveName = business_name || name;

    const { rows } = await pool.query(`
      UPDATE tenants
      SET name = COALESCE($1, name),
          business_name = COALESCE($1, business_name, name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          address = COALESCE($4, address),
          city = COALESCE($5, city),
          state = COALESCE($6, state),
          currency = COALESCE($7, currency),
          timezone = COALESCE($8, timezone),
          logo_url = COALESCE($9, logo_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [effectiveName, phone, email, address, city, state, currency, timezone, logo_url, tenantId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await logTenantAudit(tenantId, user.email, 'UPDATE_PROFILE', 'tenant', tenantId, { name: effectiveName, currency });

    res.json(rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 6. PATCH /api/os/:tenantId/settings (Admin or Owner)
businessOSRouter.patch('/:tenantId/settings', requireUserAuth, requireTenantMembership('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user: SessionData = (req as any).user;
    const {
      customer_label,
      catalog_label,
      invoice_prefix,
      quotation_prefix,
      tax_rate_percentage,
      bank_name,
      bank_account_number,
      bank_account_name,
      payment_instructions,
      whatsapp_notifications,
      email_notifications,
      receipt_footer_note
    } = req.body;

    const { rows } = await pool.query(`
      INSERT INTO tenant_settings (
        tenant_id, customer_label, catalog_label, invoice_prefix, quotation_prefix,
        tax_rate_percentage, bank_name, bank_account_number, bank_account_name,
        payment_instructions, whatsapp_notifications, email_notifications, receipt_footer_note, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id) DO UPDATE
      SET customer_label = COALESCE($2, tenant_settings.customer_label),
          catalog_label = COALESCE($3, tenant_settings.catalog_label),
          invoice_prefix = COALESCE($4, tenant_settings.invoice_prefix),
          quotation_prefix = COALESCE($5, tenant_settings.quotation_prefix),
          tax_rate_percentage = COALESCE($6, tenant_settings.tax_rate_percentage),
          bank_name = COALESCE($7, tenant_settings.bank_name),
          bank_account_number = COALESCE($8, tenant_settings.bank_account_number),
          bank_account_name = COALESCE($9, tenant_settings.bank_account_name),
          payment_instructions = COALESCE($10, tenant_settings.payment_instructions),
          whatsapp_notifications = COALESCE($11, tenant_settings.whatsapp_notifications),
          email_notifications = COALESCE($12, tenant_settings.email_notifications),
          receipt_footer_note = COALESCE($13, tenant_settings.receipt_footer_note),
          updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      tenantId,
      customer_label,
      catalog_label,
      invoice_prefix,
      quotation_prefix,
      tax_rate_percentage,
      bank_name,
      bank_account_number,
      bank_account_name,
      payment_instructions,
      whatsapp_notifications,
      email_notifications,
      receipt_footer_note
    ]);

    await logTenantAudit(tenantId, user.email, 'UPDATE_SETTINGS', 'tenant_settings', tenantId);

    res.json(rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 7. POST /api/os/:tenantId/onboarding (Owner only)
businessOSRouter.post('/:tenantId/onboarding', requireUserAuth, requireTenantMembership('owner'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user: SessionData = (req as any).user;
    const {
      industry,
      customer_label,
      catalog_label,
      bank_name,
      bank_account_number,
      bank_account_name,
      payment_instructions,
      seed_catalog
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (industry) {
        await client.query('UPDATE tenants SET industry = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [industry, tenantId]);
      }

      await client.query(`
        INSERT INTO tenant_settings (
          tenant_id, customer_label, catalog_label, bank_name,
          bank_account_number, bank_account_name, payment_instructions, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id) DO UPDATE
        SET customer_label = COALESCE($2, tenant_settings.customer_label),
            catalog_label = COALESCE($3, tenant_settings.catalog_label),
            bank_name = COALESCE($4, tenant_settings.bank_name),
            bank_account_number = COALESCE($5, tenant_settings.bank_account_number),
            bank_account_name = COALESCE($6, tenant_settings.bank_account_name),
            payment_instructions = COALESCE($7, tenant_settings.payment_instructions),
            updated_at = CURRENT_TIMESTAMP
      `, [tenantId, customer_label, catalog_label, bank_name, bank_account_number, bank_account_name, payment_instructions]);

      if (seed_catalog && industry && INDUSTRY_PRESETS[industry]) {
        const preset = INDUSTRY_PRESETS[industry];
        for (const item of preset.items) {
          await client.query(`
            INSERT INTO catalog_items (id, tenant_id, title, description, type, category, unit_price, cost_price, sku, stock_quantity, track_inventory, is_available)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, 30, FALSE, TRUE)
          `, [`cat_${crypto.randomUUID().slice(0, 8)}`, tenantId, item.title, item.description, item.type, item.category, item.unit_price, `SKU-${crypto.randomUUID().slice(0, 5).toUpperCase()}`]);
        }
      }

      await client.query('COMMIT');

      await logTenantAudit(tenantId, user.email, 'COMPLETE_ONBOARDING', 'tenant', tenantId);

      const updatedTenant = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
      res.json({ success: true, tenant: updatedTenant.rows[0] });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 8. GET /api/os/:tenantId/dashboard (Real-time Business Metrics)
businessOSRouter.get('/:tenantId/dashboard', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Total Revenue from recorded payments
    const revRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_revenue
      FROM payments
      WHERE tenant_id = $1
    `, [tenantId]);

    // Total outstanding unpaid invoices balance
    const outRes = await pool.query(`
      SELECT COALESCE(SUM(balance_due), 0) as outstanding_balance,
             COUNT(*) FILTER (WHERE status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')) as unpaid_count,
             COUNT(*) as total_invoices
      FROM invoices
      WHERE tenant_id = $1 AND status != 'CANCELLED'
    `, [tenantId]);

    // Revenue collected this current month
    const curMonthRev = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as paid_this_month
      FROM payments
      WHERE tenant_id = $1 AND payment_date >= DATE_TRUNC('month', CURRENT_DATE)
    `, [tenantId]);

    // Customers total and this month
    const custRes = await pool.query(`
      SELECT COUNT(*) as total_customers,
             COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as new_customers_this_month
      FROM customers
      WHERE tenant_id = $1
    `, [tenantId]);

    // Recent 5 sales (payments with customer & invoice reference)
    const recentSales = await pool.query(`
      SELECT p.id, p.amount, p.payment_method, p.payment_date as date, p.receipt_number,
             i.invoice_number, i.customer_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE p.tenant_id = $1
      ORDER BY p.payment_date DESC
      LIMIT 5
    `, [tenantId]);

    // Monthly revenue chart data (last 6 months)
    const chartRes = await pool.query(`
      WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
          DATE_TRUNC('month', CURRENT_DATE),
          '1 month'::interval
        ) AS m
      )
      SELECT TO_CHAR(months.m, 'Mon') as month,
             COALESCE(SUM(p.amount), 0) as revenue
      FROM months
      LEFT JOIN payments p ON DATE_TRUNC('month', p.payment_date) = months.m AND p.tenant_id = $1
      GROUP BY months.m
      ORDER BY months.m ASC
    `, [tenantId]);

    // Recent activities (invoices, payments, quotations, customers)
    const activities = await pool.query(`
      (SELECT id, 'Invoice ' || invoice_number || ' generated for ' || customer_name as title, created_at as timestamp, 'invoice' as type
       FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 3)
      UNION ALL
      (SELECT id, 'Payment ₦' || amount || ' received (' || receipt_number || ')' as title, payment_date as timestamp, 'payment' as type
       FROM payments WHERE tenant_id = $1 ORDER BY payment_date DESC LIMIT 3)
      UNION ALL
      (SELECT id, 'Quotation ' || quotation_number || ' drafted for ' || customer_name as title, created_at as timestamp, 'quotation' as type
       FROM quotations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 2)
      ORDER BY timestamp DESC
      LIMIT 6
    `, [tenantId]);

    res.json({
      totalRevenue: Number(revRes.rows[0]?.total_revenue || 0),
      outstandingBalance: Number(outRes.rows[0]?.outstanding_balance || 0),
      paidThisMonth: Number(curMonthRev.rows[0]?.paid_this_month || 0),
      totalCustomers: Number(custRes.rows[0]?.total_customers || 0),
      newCustomersThisMonth: Number(custRes.rows[0]?.new_customers_this_month || 0),
      totalInvoices: Number(outRes.rows[0]?.total_invoices || 0),
      unpaidInvoicesCount: Number(outRes.rows[0]?.unpaid_count || 0),
      recentSales: recentSales.rows,
      monthlySalesChart: chartRes.rows.map(r => ({ month: r.month, revenue: Number(r.revenue) })),
      recentActivities: activities.rows
    });
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 9. GET /api/os/:tenantId/customers
businessOSRouter.get('/:tenantId/customers', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { search } = req.query;

    let query = `SELECT * FROM customers WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR company_name ILIKE $2)`;
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 10. POST /api/os/:tenantId/customers (Quota-checked)
businessOSRouter.post('/:tenantId/customers', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user: SessionData = (req as any).user;
    const { name, email, phone, company_name, address, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    // Check Plan Quota
    const quota = await checkPlanLimits(tenantId, 'customers');
    if (!quota.allowed) {
      return res.status(403).json({ error: quota.error, quotaExceeded: true, limit: quota.limit, current: quota.current });
    }

    const id = `cust_${crypto.randomUUID().slice(0, 8)}`;
    const { rows } = await pool.query(`
      INSERT INTO customers (id, tenant_id, name, email, phone, company_name, address, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, tenantId, name.trim(), email || null, phone || null, company_name || null, address || null, notes || null]);

    await logTenantAudit(tenantId, user.email, 'CREATE_CUSTOMER', 'customer', id, { name });

    res.status(201).json(rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 11. PATCH /api/os/:tenantId/customers/:customerId
businessOSRouter.patch('/:tenantId/customers/:customerId', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId, customerId } = req.params;
    const user: SessionData = (req as any).user;
    const { name, email, phone, company_name, address, notes, status } = req.body;

    const { rows } = await pool.query(`
      UPDATE customers
      SET name = COALESCE($1, name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          company_name = COALESCE($4, company_name),
          address = COALESCE($5, address),
          notes = COALESCE($6, notes),
          status = COALESCE($7, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND tenant_id = $9
      RETURNING *
    `, [name, email, phone, company_name, address, notes, status, customerId, tenantId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Customer not found in this business organization' });
    }

    await logTenantAudit(tenantId, user.email, 'UPDATE_CUSTOMER', 'customer', customerId);

    res.json(rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 12. DELETE /api/os/:tenantId/customers/:customerId (Admin or Owner)
businessOSRouter.delete('/:tenantId/customers/:customerId', requireUserAuth, requireTenantMembership('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId, customerId } = req.params;
    const user: SessionData = (req as any).user;

    const delRes = await pool.query('DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING id', [customerId, tenantId]);
    if (!delRes.rows.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await logTenantAudit(tenantId, user.email, 'DELETE_CUSTOMER', 'customer', customerId);

    res.json({ success: true });
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 13. GET /api/os/:tenantId/catalog
businessOSRouter.get('/:tenantId/catalog', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { search, category, type } = req.query;

    let query = `SELECT * FROM catalog_items WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let idx = 2;

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (title ILIKE $${idx} OR sku ILIKE $${idx} OR description ILIKE $${idx})`;
      idx++;
    }

    if (category && typeof category === 'string' && category !== 'ALL') {
      params.push(category);
      query += ` AND category = $${idx}`;
      idx++;
    }

    if (type && typeof type === 'string' && type !== 'ALL') {
      params.push(type);
      query += ` AND type = $${idx}`;
      idx++;
    }

    query += ` ORDER BY category ASC, title ASC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 14. POST /api/os/:tenantId/catalog (Admin or Owner, Quota-checked)
businessOSRouter.post('/:tenantId/catalog', requireUserAuth, requireTenantMembership('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user: SessionData = (req as any).user;
    const {
      title,
      description,
      type = 'service',
      category = 'General',
      unit_price = 0,
      cost_price = 0,
      sku,
      stock_quantity = 0,
      track_inventory = false,
      is_available = true
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Item title is required' });
    }

    // Check Plan Quota
    const quota = await checkPlanLimits(tenantId, 'catalog');
    if (!quota.allowed) {
      return res.status(403).json({ error: quota.error, quotaExceeded: true, limit: quota.limit, current: quota.current });
    }

    const id = `cat_${crypto.randomUUID().slice(0, 8)}`;
    const { rows } = await pool.query(`
      INSERT INTO catalog_items (
        id, tenant_id, title, description, type, category,
        unit_price, cost_price, sku, stock_quantity, track_inventory, is_available
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [id, tenantId, title.trim(), description || null, type, category, unit_price, cost_price, sku || null, stock_quantity, track_inventory, is_available]);

    await logTenantAudit(tenantId, user.email, 'CREATE_CATALOG_ITEM', 'catalog_item', id, { title });

    res.status(201).json(rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 15. PATCH /api/os/:tenantId/catalog/:itemId (Admin or Owner)
businessOSRouter.patch('/:tenantId/catalog/:itemId', requireUserAuth, requireTenantMembership('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId, itemId } = req.params;
    const user: SessionData = (req as any).user;
    const {
      title,
      description,
      type,
      category,
      unit_price,
      cost_price,
      sku,
      stock_quantity,
      track_inventory,
      is_available
    } = req.body;

    const { rows } = await pool.query(`
      UPDATE catalog_items
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          type = COALESCE($3, type),
          category = COALESCE($4, category),
          unit_price = COALESCE($5, unit_price),
          cost_price = COALESCE($6, cost_price),
          sku = COALESCE($7, sku),
          stock_quantity = COALESCE($8, stock_quantity),
          track_inventory = COALESCE($9, track_inventory),
          is_available = COALESCE($10, is_available),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND tenant_id = $12
      RETURNING *
    `, [title, description, type, category, unit_price, cost_price, sku, stock_quantity, track_inventory, is_available, itemId, tenantId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Item not found in this business organization' });
    }

    await logTenantAudit(tenantId, user.email, 'UPDATE_CATALOG_ITEM', 'catalog_item', itemId);

    res.json(rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 16. DELETE /api/os/:tenantId/catalog/:itemId (Admin or Owner)
businessOSRouter.delete('/:tenantId/catalog/:itemId', requireUserAuth, requireTenantMembership('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId, itemId } = req.params;
    const user: SessionData = (req as any).user;

    const delRes = await pool.query('DELETE FROM catalog_items WHERE id = $1 AND tenant_id = $2 RETURNING id', [itemId, tenantId]);
    if (!delRes.rows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await logTenantAudit(tenantId, user.email, 'DELETE_CATALOG_ITEM', 'catalog_item', itemId);

    res.json({ success: true });
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 17. GET /api/os/:tenantId/quotations
businessOSRouter.get('/:tenantId/quotations', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { status } = req.query;

    let query = `
      SELECT q.*, 
             COALESCE(json_agg(qi.*) FILTER (WHERE qi.id IS NOT NULL), '[]'::json) as items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      WHERE q.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (status && typeof status === 'string') {
      params.push(status);
      query += ` AND q.status = $2`;
    }

    query += ` GROUP BY q.id ORDER BY q.created_at DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 18. POST /api/os/:tenantId/quotations (Cross-tenant catalog item validation, Quota-checked)
businessOSRouter.post('/:tenantId/quotations', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user: SessionData = (req as any).user;
    const {
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      issue_date,
      expiry_date,
      items = [],
      discount_amount = 0,
      tax_amount = 0,
      notes
    } = req.body;

    let resolvedCustomerName = customer_name;
    let resolvedCustomerEmail = customer_email;
    let resolvedCustomerPhone = customer_phone;

    if (customer_id && (!resolvedCustomerName || !resolvedCustomerName.trim())) {
      const custRes = await pool.query('SELECT name, email, phone FROM customers WHERE id = $1 AND tenant_id = $2', [customer_id, tenantId]);
      if (custRes.rows.length > 0) {
        resolvedCustomerName = custRes.rows[0].name;
        resolvedCustomerEmail = resolvedCustomerEmail || custRes.rows[0].email;
        resolvedCustomerPhone = resolvedCustomerPhone || custRes.rows[0].phone;
      }
    }

    if (!resolvedCustomerName || !resolvedCustomerName.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    // Check Plan Quota
    const quota = await checkPlanLimits(tenantId, 'invoices');
    if (!quota.allowed) {
      return res.status(403).json({ error: quota.error, quotaExceeded: true, limit: quota.limit, current: quota.current });
    }

    // Strict Cross-tenant Catalog Validation: Ensure any referenced catalog items belong to this tenant!
    for (const item of items) {
      if (item.catalog_item_id) {
        const itemCheck = await pool.query(
          'SELECT id FROM catalog_items WHERE id = $1 AND tenant_id = $2',
          [item.catalog_item_id, tenantId]
        );
        if (itemCheck.rows.length === 0) {
          return res.status(400).json({ error: `Security Violation: Catalog item ${item.catalog_item_id} does not belong to this business organization.` });
        }
      }
    }

    const quotationId = `qte_${crypto.randomUUID().slice(0, 8)}`;
    const quotationNumber = `QTE-${Date.now().toString().slice(-6)}`;

    // Recalculate totals server-side
    let subtotal = 0;
    for (const item of items) {
      subtotal += Math.max(0, Number(item.unit_price || 0)) * Math.max(1, Number(item.quantity || 1));
    }
    const finalDiscount = Number(discount_amount || req.body.discount || 0);
    let finalTax = Number(tax_amount || 0);
    if (!finalTax && req.body.tax_rate) {
      finalTax = Math.round(subtotal * (Number(req.body.tax_rate) / 100));
    }
    const totalAmount = Math.max(0, subtotal + finalTax - finalDiscount);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const qRes = await client.query(`
        INSERT INTO quotations (
          id, tenant_id, quotation_number, customer_id, customer_name,
          customer_email, customer_phone, status, issue_date, expiry_date,
          subtotal, tax_amount, discount_amount, total_amount, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', COALESCE($8::date, CURRENT_DATE), COALESCE($9::date, CURRENT_DATE + INTERVAL '14 days'), $10, $11, $12, $13, $14)
        RETURNING *
      `, [quotationId, tenantId, quotationNumber, customer_id || null, resolvedCustomerName.trim(), resolvedCustomerEmail || null, resolvedCustomerPhone || null, issue_date, expiry_date, subtotal, finalTax, finalDiscount, totalAmount, notes || null]);

      for (const item of items) {
        await client.query(`
          INSERT INTO quotation_items (id, quotation_id, catalog_item_id, title, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          `qi_${crypto.randomUUID().slice(0, 8)}`,
          quotationId,
          item.catalog_item_id || null,
          item.title || item.item_name || 'Service Item',
          item.quantity || 1,
          item.unit_price || 0,
          Number(item.unit_price || 0) * Number(item.quantity || 1)
        ]);
      }

      await client.query('COMMIT');

      await logTenantAudit(tenantId, user.email, 'CREATE_QUOTATION', 'quotation', quotationId, { quotationNumber, totalAmount });

      res.status(201).json(qRes.rows[0]);
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 19. POST /api/os/:tenantId/quotations/:quotationId/convert
businessOSRouter.post('/:tenantId/quotations/:quotationId/convert', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId, quotationId } = req.params;
    const user: SessionData = (req as any).user;

    const qRes = await pool.query('SELECT * FROM quotations WHERE id = $1 AND tenant_id = $2', [quotationId, tenantId]);
    if (!qRes.rows.length) {
      return res.status(404).json({ error: 'Quotation not found in this organization' });
    }
    const qte = qRes.rows[0];

    const itemsRes = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [quotationId]);

    const invoiceId = `inv_${crypto.randomUUID().slice(0, 8)}`;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const invRes = await client.query(`
        INSERT INTO invoices (
          id, tenant_id, invoice_number, quotation_id, customer_id,
          customer_name, customer_email, customer_phone, status, issue_date,
          due_date, subtotal, tax_amount, discount_amount, total_amount,
          amount_paid, balance_due, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UNPAID', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', $9, $10, $11, $12, 0, $12, $13)
        RETURNING *
      `, [invoiceId, tenantId, invoiceNumber, quotationId, qte.customer_id, qte.customer_name, qte.customer_email, qte.customer_phone, qte.subtotal, qte.tax_amount, qte.discount_amount, qte.total_amount, qte.notes]);

      for (const item of itemsRes.rows) {
        await client.query(`
          INSERT INTO invoice_items (id, invoice_id, catalog_item_id, title, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [`ii_${crypto.randomUUID().slice(0, 8)}`, invoiceId, item.catalog_item_id, item.title, item.quantity, item.unit_price, item.total_price]);
      }

      await client.query('UPDATE quotations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['CONVERTED', quotationId]);

      // If customer exists, update outstanding balance
      if (qte.customer_id) {
        await client.query(`
          UPDATE customers
          SET outstanding_balance = outstanding_balance + $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [qte.total_amount, qte.customer_id]);
      }

      await client.query('COMMIT');

      await logTenantAudit(tenantId, user.email, 'CONVERT_QUOTATION_TO_INVOICE', 'invoice', invoiceId, { quotationId, invoiceNumber });

      res.json(invRes.rows[0]);
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 20. GET /api/os/:tenantId/invoices
businessOSRouter.get('/:tenantId/invoices', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { status } = req.query;

    let query = `
      SELECT i.*,
             COALESCE(json_agg(DISTINCT ii.*) FILTER (WHERE ii.id IS NOT NULL), '[]'::json) as items,
             COALESCE(json_agg(DISTINCT p.*) FILTER (WHERE p.id IS NOT NULL), '[]'::json) as payments
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN payments p ON i.id = p.invoice_id
      WHERE i.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (status && typeof status === 'string' && status !== 'ALL') {
      params.push(status);
      query += ` AND i.status = $2`;
    }

    query += ` GROUP BY i.id ORDER BY i.created_at DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 21. GET /api/os/:tenantId/invoices/:invoiceId
businessOSRouter.get('/:tenantId/invoices/:invoiceId', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId, invoiceId } = req.params;
    const invRes = await pool.query(`
      SELECT i.*,
             COALESCE(json_agg(DISTINCT ii.*) FILTER (WHERE ii.id IS NOT NULL), '[]'::json) as items,
             COALESCE(json_agg(DISTINCT p.*) FILTER (WHERE p.id IS NOT NULL), '[]'::json) as payments
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN payments p ON i.id = p.invoice_id
      WHERE i.id = $1 AND i.tenant_id = $2
      GROUP BY i.id
    `, [invoiceId, tenantId]);

    if (!invRes.rows.length) {
      return res.status(404).json({ error: 'Invoice not found in this business organization' });
    }

    res.json(invRes.rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 22. POST /api/os/:tenantId/invoices (Quota-checked, Cross-tenant validation)
businessOSRouter.post('/:tenantId/invoices', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user: SessionData = (req as any).user;
    const {
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      issue_date,
      due_date,
      items = [],
      discount_amount = 0,
      tax_amount = 0,
      notes
    } = req.body;

    let resolvedCustomerName = customer_name;
    let resolvedCustomerEmail = customer_email;
    let resolvedCustomerPhone = customer_phone;

    if (customer_id && (!resolvedCustomerName || !resolvedCustomerName.trim())) {
      const custRes = await pool.query('SELECT name, email, phone FROM customers WHERE id = $1 AND tenant_id = $2', [customer_id, tenantId]);
      if (custRes.rows.length > 0) {
        resolvedCustomerName = custRes.rows[0].name;
        resolvedCustomerEmail = resolvedCustomerEmail || custRes.rows[0].email;
        resolvedCustomerPhone = resolvedCustomerPhone || custRes.rows[0].phone;
      }
    }

    if (!resolvedCustomerName || !resolvedCustomerName.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    // Check Plan Quota
    const quota = await checkPlanLimits(tenantId, 'invoices');
    if (!quota.allowed) {
      return res.status(403).json({ error: quota.error, quotaExceeded: true, limit: quota.limit, current: quota.current });
    }

    // Strict Cross-tenant Catalog Validation: Ensure any referenced catalog items belong to this tenant!
    for (const item of items) {
      if (item.catalog_item_id) {
        const itemCheck = await pool.query(
          'SELECT id FROM catalog_items WHERE id = $1 AND tenant_id = $2',
          [item.catalog_item_id, tenantId]
        );
        if (itemCheck.rows.length === 0) {
          return res.status(400).json({ error: `Security Violation: Catalog item ${item.catalog_item_id} does not belong to this business organization.` });
        }
      }
    }

    const invoiceId = `inv_${crypto.randomUUID().slice(0, 8)}`;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    // Recalculate totals server-side
    let subtotal = 0;
    for (const item of items) {
      subtotal += Math.max(0, Number(item.unit_price || 0)) * Math.max(1, Number(item.quantity || 1));
    }
    const finalDiscount = Number(discount_amount || req.body.discount || 0);
    let finalTax = Number(tax_amount || 0);
    if (!finalTax && req.body.tax_rate) {
      finalTax = Math.round(subtotal * (Number(req.body.tax_rate) / 100));
    }
    const totalAmount = Math.max(0, subtotal + finalTax - finalDiscount);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const invRes = await client.query(`
        INSERT INTO invoices (
          id, tenant_id, invoice_number, customer_id, customer_name,
          customer_email, customer_phone, status, issue_date, due_date,
          subtotal, tax_amount, discount_amount, total_amount,
          amount_paid, balance_due, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'UNPAID', COALESCE($8::date, CURRENT_DATE), COALESCE($9::date, CURRENT_DATE + INTERVAL '7 days'), $10, $11, $12, $13, 0, $13, $14)
        RETURNING *
      `, [invoiceId, tenantId, invoiceNumber, customer_id || null, resolvedCustomerName.trim(), resolvedCustomerEmail || null, resolvedCustomerPhone || null, issue_date, due_date, subtotal, finalTax, finalDiscount, totalAmount, notes || null]);

      for (const item of items) {
        await client.query(`
          INSERT INTO invoice_items (id, invoice_id, catalog_item_id, title, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          `ii_${crypto.randomUUID().slice(0, 8)}`,
          invoiceId,
          item.catalog_item_id || null,
          item.title || item.item_name || 'Item',
          item.quantity || 1,
          item.unit_price || 0,
          Number(item.unit_price || 0) * Number(item.quantity || 1)
        ]);
      }

      // If customer selected, add to their outstanding balance
      if (customer_id) {
        await client.query(`
          UPDATE customers
          SET outstanding_balance = outstanding_balance + $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3
        `, [totalAmount, customer_id, tenantId]);
      }

      await client.query('COMMIT');

      await logTenantAudit(tenantId, user.email, 'CREATE_INVOICE', 'invoice', invoiceId, { invoiceNumber, totalAmount });

      res.status(201).json(invRes.rows[0]);
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 23. DELETE /api/os/:tenantId/invoices/:invoiceId (Admin or Owner)
businessOSRouter.delete('/:tenantId/invoices/:invoiceId', requireUserAuth, requireTenantMembership('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId, invoiceId } = req.params;
    const user: SessionData = (req as any).user;

    const delRes = await pool.query('DELETE FROM invoices WHERE id = $1 AND tenant_id = $2 RETURNING id', [invoiceId, tenantId]);
    if (!delRes.rows.length) {
      return res.status(404).json({ error: 'Invoice not found in this business organization' });
    }

    await logTenantAudit(tenantId, user.email, 'DELETE_INVOICE', 'invoice', invoiceId);

    res.json({ success: true });
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 24. POST /api/os/:tenantId/invoices/:invoiceId/payments (Record Payment, Validate Balance, Idempotent)
businessOSRouter.post('/:tenantId/invoices/:invoiceId/payments', requireUserAuth, requireTenantMembership('staff'), async (req: Request, res: Response) => {
  try {
    const { tenantId, invoiceId } = req.params;
    const user: SessionData = (req as any).user;
    const { amount, payment_method = 'BANK_TRANSFER', reference, notes } = req.body;

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount greater than zero is required' });
    }

    // Idempotency check on reference if provided
    if (reference && typeof reference === 'string' && reference.trim()) {
      const existingPay = await pool.query(
        'SELECT * FROM payments WHERE tenant_id = $1 AND reference = $2',
        [tenantId, reference.trim()]
      );
      if (existingPay.rows.length > 0) {
        return res.status(200).json({
          payment: existingPay.rows[0],
          duplicate: true,
          message: 'Payment with this transaction reference has already been processed.'
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch invoice with row-level lock
      const invRes = await client.query('SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [invoiceId, tenantId]);
      if (!invRes.rows.length) {
        throw new Error('Invoice not found in this business organization');
      }
      const inv = invRes.rows[0];

      // Prevent overpayment
      const currentBalanceDue = Number(inv.balance_due);
      if (paymentAmount > currentBalanceDue) {
        throw new Error(`Payment amount (₦${paymentAmount}) exceeds outstanding invoice balance (₦${currentBalanceDue})`);
      }

      const newAmountPaid = Number(inv.amount_paid) + paymentAmount;
      const newBalanceDue = Math.max(0, Number(inv.total_amount) - newAmountPaid);
      const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      const paymentId = `pay_${crypto.randomUUID().slice(0, 8)}`;
      const receiptNumber = `RCPT-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

      // Insert payment with verified user identity
      const payRes = await client.query(`
        INSERT INTO payments (id, tenant_id, invoice_id, amount, payment_method, reference, receipt_number, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [paymentId, tenantId, invoiceId, paymentAmount, payment_method, reference?.trim() || null, receiptNumber, notes || null, user.email]);

      // Update invoice
      const updatedInv = await client.query(`
        UPDATE invoices
        SET amount_paid = $1,
            balance_due = $2,
            status = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [newAmountPaid, newBalanceDue, newStatus, invoiceId]);

      // Update customer total_spent and balance
      if (inv.customer_id) {
        await client.query(`
          UPDATE customers
          SET total_spent = total_spent + $1,
              outstanding_balance = GREATEST(0, outstanding_balance - $1),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3
        `, [paymentAmount, inv.customer_id, tenantId]);
      }

      await client.query('COMMIT');

      await logTenantAudit(tenantId, user.email, 'RECORD_PAYMENT', 'payment', paymentId, { amount: paymentAmount, invoiceId, receiptNumber });

      res.status(201).json({
        payment: payRes.rows[0],
        invoice: updatedInv.rows[0]
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 25. GET /api/os/:tenantId/staff (Admin or Owner)
businessOSRouter.get('/:tenantId/staff', requireUserAuth, requireTenantMembership('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { rows } = await pool.query('SELECT * FROM tenant_members WHERE tenant_id = $1 ORDER BY created_at ASC', [tenantId]);
    res.json(rows);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 26. POST /api/os/:tenantId/staff (Admin or Owner, Seat Quota checked, Privilege Escalation Guard)
businessOSRouter.post('/:tenantId/staff', requireUserAuth, requireTenantMembership('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const caller = (req as any).tenantMembership;
    const user: SessionData = (req as any).user;
    const { name, email, role = 'staff', phone } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Staff email is required' });
    }

    const assignedRole = ['owner', 'admin', 'staff'].includes(role) ? role : 'staff';

    // Privilege escalation protection: Only an owner (or super admin) can create an 'owner' or 'admin'
    if (caller.role !== 'owner' && !caller.isSuperAdmin && (assignedRole === 'owner' || assignedRole === 'admin')) {
      return res.status(403).json({ error: 'Forbidden: Only the business owner can assign administrator or owner roles.' });
    }

    // Check staff quota
    const quota = await checkPlanLimits(tenantId, 'staff');
    if (!quota.allowed) {
      return res.status(403).json({ error: quota.error, quotaExceeded: true, limit: quota.limit, current: quota.current });
    }

    const id = `tm_${crypto.randomUUID().slice(0, 8)}`;
    const { rows } = await pool.query(`
      INSERT INTO tenant_members (id, tenant_id, user_email, role, name, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      ON CONFLICT (tenant_id, user_email) DO UPDATE
      SET role = EXCLUDED.role,
          name = COALESCE(EXCLUDED.name, tenant_members.name),
          phone = COALESCE(EXCLUDED.phone, tenant_members.phone),
          is_active = TRUE
      RETURNING *
    `, [id, tenantId, email.trim().toLowerCase(), assignedRole, name || null, phone || null]);

    await logTenantAudit(tenantId, user.email, 'ADD_STAFF_MEMBER', 'tenant_member', id, { email, role: assignedRole });

    res.status(201).json(rows[0]);
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

// 27. DELETE /api/os/:tenantId/staff/:memberId (Owner only, Protected against removing self or last owner)
businessOSRouter.delete('/:tenantId/staff/:memberId', requireUserAuth, requireTenantMembership('owner'), async (req: Request, res: Response) => {
  try {
    const { tenantId, memberId } = req.params;
    const user: SessionData = (req as any).user;

    const targetMember = await pool.query('SELECT * FROM tenant_members WHERE id = $1 AND tenant_id = $2', [memberId, tenantId]);
    if (!targetMember.rows.length) {
      return res.status(404).json({ error: 'Team member not found in this business organization' });
    }

    const member = targetMember.rows[0];

    // Prevent removing primary owner email defined in tenants table
    const tenantCheck = await pool.query('SELECT owner_email FROM tenants WHERE id = $1', [tenantId]);
    if (tenantCheck.rows[0]?.owner_email?.toLowerCase() === member.user_email?.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot remove primary business owner account.' });
    }

    await pool.query('DELETE FROM tenant_members WHERE id = $1 AND tenant_id = $2', [memberId, tenantId]);

    await logTenantAudit(tenantId, user.email, 'REMOVE_STAFF_MEMBER', 'tenant_member', memberId, { email: member.user_email });

    res.json({ success: true });
  } catch (err: any) {
    sendSafeRouterError(res, err, 'business-os');
  }
});

type PaymentVerificationSource = 'verify' | 'callback' | 'webhook';

interface VerifyPaymentOptions {
  source: PaymentVerificationSource;
  requireAuthorizedUser?: SessionData;
  webhookEvent?: {
    eventKey: string;
    eventType: string;
    payload: any;
    transactionId?: any;
    channel?: string;
    customerEmail?: string;
  };
}

interface VerifyPaymentOutcome {
  ok: boolean;
  httpStatus: number;
  code: string;
  message?: string;
  error?: string;
  alreadyProcessed?: boolean;
  tenant?: any;
  tenantId?: string;
}

/**
 * Shared authoritative Paystack transaction verification and atomic subscription activation.
 * Enforces:
 * - Valid reference format & exact reference match against Paystack
 * - Existing PENDING payment record in Neon with row-level lock (FOR UPDATE)
 * - Existing tenant & active non-free subscription plan in Neon
 * - Exact amount in kobo & exact currency match against both payment record and subscription plan
 * - Optional metadata (tenant_id, plan_id) & customer email consistency checks
 * - Rejects failed, abandoned, duplicate, or mismatched transactions without activating
 * - Atomic single activation via unique constraint on subscriptions(payment_reference)
 */
async function verifyAndActivatePaystackPayment(
  rawReference: string,
  options: VerifyPaymentOptions
): Promise<VerifyPaymentOutcome> {
  if (!isValidPaystackReference(rawReference)) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'INVALID_REFERENCE',
      error: 'A valid payment reference is required.'
    };
  }

  const cleanRef = rawReference.trim();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Look up existing payment record with row-level lock
    const paymentRes = await client.query(
      'SELECT * FROM payments WHERE provider_reference = $1 FOR UPDATE',
      [cleanRef]
    );

    if (!paymentRes.rows.length) {
      if (options.webhookEvent) {
        await client.query(
          `INSERT INTO webhook_events (id, provider, event_key, event_type, payload, status)
           VALUES ($1, 'paystack', $2, $3, $4, 'UNMATCHED')
           ON CONFLICT (event_key) DO NOTHING`,
          [
            `whe_${crypto.randomUUID().slice(0, 8)}`,
            options.webhookEvent.eventKey,
            options.webhookEvent.eventType,
            JSON.stringify(options.webhookEvent.payload)
          ]
        );
        await client.query('COMMIT');
        return {
          ok: false,
          httpStatus: 200,
          code: 'UNMATCHED',
          error: 'No matching pending payment record found in database.'
        };
      }
      await client.query('ROLLBACK');
      return {
        ok: false,
        httpStatus: 404,
        code: 'NOT_FOUND',
        error: 'No transaction record found for this reference.'
      };
    }

    const payment = paymentRes.rows[0];
    const tenantId: string = payment.tenant_id;
    const planId: string = payment.plan_id;

    if (payment.provider && String(payment.provider).toLowerCase() !== 'paystack') {
      await client.query('ROLLBACK');
      return {
        ok: false,
        httpStatus: 400,
        code: 'INVALID_PROVIDER',
        error: 'Payment reference is not associated with Paystack.'
      };
    }

    // 2. Verify tenant exists (and authorize caller when invoked via authenticated verify endpoint)
    const tenantLookup = await client.query(
      'SELECT id, owner_email, status FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (!tenantLookup.rows.length) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        httpStatus: 404,
        code: 'TENANT_NOT_FOUND',
        error: 'Associated tenant not found.'
      };
    }

    if (options.requireAuthorizedUser) {
      const user = options.requireAuthorizedUser;
      const tenantRow = tenantLookup.rows[0];
      const isDirectOwner =
        tenantRow.owner_email && tenantRow.owner_email.toLowerCase() === user.email.toLowerCase();

      let memberRole: string | null = null;
      if (!isDirectOwner && user.role !== 'admin') {
        const memberRes = await client.query(
          'SELECT role FROM tenant_members WHERE tenant_id = $1 AND LOWER(user_email) = LOWER($2) AND is_active = TRUE',
          [tenantId, user.email]
        );
        memberRole = memberRes.rows[0]?.role || null;
      }

      const isAuthorized = user.role === 'admin' || isDirectOwner || memberRole === 'owner';
      if (!isAuthorized) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          httpStatus: 403,
          code: 'FORBIDDEN',
          error: 'Forbidden: Business owner privileges required to verify billing.'
        };
      }
    }

    // 3. Idempotent return if already verified/activated
    if (payment.status === 'SUCCESS' || payment.status === 'PAID') {
      if (options.webhookEvent) {
        await client.query(
          `INSERT INTO webhook_events (id, provider, event_key, event_type, payload, status)
           VALUES ($1, 'paystack', $2, $3, $4, 'PROCESSED')
           ON CONFLICT (event_key) DO NOTHING`,
          [
            `whe_${crypto.randomUUID().slice(0, 8)}`,
            options.webhookEvent.eventKey,
            options.webhookEvent.eventType,
            JSON.stringify(options.webhookEvent.payload)
          ]
        );
      }
      await client.query('COMMIT');
      const activeTenant = await pool.query(
        'SELECT t.*, row_to_json(sp) as plan FROM tenants t LEFT JOIN subscription_plans sp ON t.plan_id = sp.id WHERE t.id = $1',
        [tenantId]
      );
      return {
        ok: true,
        httpStatus: 200,
        code: 'ALREADY_PROCESSED',
        alreadyProcessed: true,
        message: 'Payment already verified and active.',
        tenant: activeTenant.rows[0],
        tenantId
      };
    }

    // 4. Reject terminal non-pending payment states (failed, abandoned, mismatches, refunded)
    if (payment.status !== 'PENDING') {
      if (options.webhookEvent) {
        await client.query(
          `INSERT INTO webhook_events (id, provider, event_key, event_type, payload, status)
           VALUES ($1, 'paystack', $2, $3, $4, $5)
           ON CONFLICT (event_key) DO NOTHING`,
          [
            `whe_${crypto.randomUUID().slice(0, 8)}`,
            options.webhookEvent.eventKey,
            options.webhookEvent.eventType,
            JSON.stringify(options.webhookEvent.payload),
            `REJECTED_${String(payment.status || 'INVALID')}`
          ]
        );
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      return {
        ok: false,
        httpStatus: 400,
        code: String(payment.status || 'INVALID_STATE'),
        tenantId,
        error: `Payment cannot activate subscription (status: ${payment.status}).`
      };
    }

    // 5. Verify subscription plan exists, is active, paid, and matches expected payment amount
    const planRes = await client.query(
      'SELECT id, name, price_ngn, is_active FROM subscription_plans WHERE id = $1',
      [planId]
    );

    const plan = planRes.rows[0];
    const planPriceNgn = plan ? Number(plan.price_ngn) : 0;
    const expectedPlanAmountKobo = Math.round(planPriceNgn * 100);
    const storedAmountKobo = Number(payment.amount_kobo || Math.round(Number(payment.amount || 0) * 100));

    if (
      !plan ||
      !plan.is_active ||
      plan.id === 'free' ||
      expectedPlanAmountKobo <= 0 ||
      storedAmountKobo <= 0 ||
      storedAmountKobo !== expectedPlanAmountKobo
    ) {
      await client.query(
        "UPDATE payments SET status = 'PLAN_MISMATCH', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1",
        [cleanRef]
      );
      if (options.webhookEvent) {
        await client.query(
          `INSERT INTO webhook_events (id, provider, event_key, event_type, payload, status)
           VALUES ($1, 'paystack', $2, $3, $4, 'PLAN_MISMATCH')
           ON CONFLICT (event_key) DO NOTHING`,
          [
            `whe_${crypto.randomUUID().slice(0, 8)}`,
            options.webhookEvent.eventKey,
            options.webhookEvent.eventType,
            JSON.stringify(options.webhookEvent.payload)
          ]
        );
      }
      await client.query('COMMIT');
      return {
        ok: false,
        httpStatus: 400,
        code: 'PLAN_MISMATCH',
        tenantId,
        error: 'Associated subscription plan or expected payment amount is invalid.'
      };
    }

    // 6. Call Paystack API server-to-server (never trust query parameters or webhook payloads alone)
    const verifyRes = await verifyPaystackTransaction(cleanRef);

    if (verifyRes.transientError) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        httpStatus: 502,
        code: 'VERIFICATION_UNAVAILABLE',
        tenantId,
        error: verifyRes.error || 'Unable to verify transaction with payment provider right now. Please retry shortly.'
      };
    }

    if (verifyRes.status === 'pending') {
      await client.query('ROLLBACK');
      return {
        ok: false,
        httpStatus: 400,
        code: 'PENDING',
        tenantId,
        error: 'Transaction is still pending confirmation from Paystack.'
      };
    }

    if (verifyRes.status === 'abandoned') {
      await client.query(
        "UPDATE payments SET status = 'ABANDONED', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1",
        [cleanRef]
      );
      if (options.webhookEvent) {
        await client.query(
          `INSERT INTO webhook_events (id, provider, event_key, event_type, payload, status)
           VALUES ($1, 'paystack', $2, $3, $4, 'ABANDONED')
           ON CONFLICT (event_key) DO NOTHING`,
          [
            `whe_${crypto.randomUUID().slice(0, 8)}`,
            options.webhookEvent.eventKey,
            options.webhookEvent.eventType,
            JSON.stringify(options.webhookEvent.payload)
          ]
        );
      }
      await client.query('COMMIT');
      return {
        ok: false,
        httpStatus: 400,
        code: 'ABANDONED',
        tenantId,
        error: verifyRes.error || 'Payment was abandoned and cannot activate a subscription.'
      };
    }

    if (!verifyRes.success || verifyRes.status !== 'success') {
      await client.query(
        "UPDATE payments SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1",
        [cleanRef]
      );
      if (options.webhookEvent) {
        await client.query(
          `INSERT INTO webhook_events (id, provider, event_key, event_type, payload, status)
           VALUES ($1, 'paystack', $2, $3, $4, 'FAILED_VERIFICATION')
           ON CONFLICT (event_key) DO NOTHING`,
          [
            `whe_${crypto.randomUUID().slice(0, 8)}`,
            options.webhookEvent.eventKey,
            options.webhookEvent.eventType,
            JSON.stringify(options.webhookEvent.payload)
          ]
        );
      }
      await client.query('COMMIT');
      return {
        ok: false,
        httpStatus: 400,
        code: 'FAILED',
        tenantId,
        error: verifyRes.error || `Payment verification failed with status: ${verifyRes.status}`
      };
    }

    // 7. Strict reference, amount, currency, metadata & customer checks
    if (!verifyRes.reference || verifyRes.reference !== cleanRef) {
      await client.query(
        "UPDATE payments SET status = 'REFERENCE_MISMATCH', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1",
        [cleanRef]
      );
      await client.query('COMMIT');
      return {
        ok: false,
        httpStatus: 400,
        code: 'REFERENCE_MISMATCH',
        tenantId,
        error: 'Payment reference mismatch between Paystack verification and pending transaction.'
      };
    }

    if (verifyRes.amountKobo !== storedAmountKobo || verifyRes.amountKobo !== expectedPlanAmountKobo) {
      console.error(
        `[Security Alert] Amount mismatch for ref ${cleanRef}: expected ${storedAmountKobo} kobo, received ${verifyRes.amountKobo} kobo`
      );
      await client.query(
        "UPDATE payments SET status = 'AMOUNT_MISMATCH', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1",
        [cleanRef]
      );
      await client.query('COMMIT');
      return {
        ok: false,
        httpStatus: 400,
        code: 'AMOUNT_MISMATCH',
        tenantId,
        error: 'Payment amount mismatch: verified amount does not match expected plan price.'
      };
    }

    const expectedCurrency = (payment.currency || getPaystackPaymentCurrency()).toUpperCase();
    if (verifyRes.currency !== expectedCurrency) {
      await client.query(
        "UPDATE payments SET status = 'CURRENCY_MISMATCH', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1",
        [cleanRef]
      );
      await client.query('COMMIT');
      return {
        ok: false,
        httpStatus: 400,
        code: 'CURRENCY_MISMATCH',
        tenantId,
        error: `Payment currency mismatch: expected ${expectedCurrency}.`
      };
    }

    if (verifyRes.metadata?.tenant_id && String(verifyRes.metadata.tenant_id) !== String(tenantId)) {
      await client.query(
        "UPDATE payments SET status = 'TENANT_MISMATCH', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1",
        [cleanRef]
      );
      await client.query('COMMIT');
      return {
        ok: false,
        httpStatus: 400,
        code: 'TENANT_MISMATCH',
        tenantId,
        error: 'Payment tenant mismatch.'
      };
    }

    if (verifyRes.metadata?.plan_id && String(verifyRes.metadata.plan_id) !== String(planId)) {
      await client.query(
        "UPDATE payments SET status = 'PLAN_MISMATCH', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1",
        [cleanRef]
      );
      await client.query('COMMIT');
      return {
        ok: false,
        httpStatus: 400,
        code: 'PLAN_MISMATCH',
        tenantId,
        error: 'Payment subscription plan mismatch.'
      };
    }

    if (
      verifyRes.customerEmail &&
      payment.user_email &&
      verifyRes.customerEmail.toLowerCase().trim() !== payment.user_email.toLowerCase().trim()
    ) {
      await client.query(
        "UPDATE payments SET status = 'CUSTOMER_MISMATCH', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1",
        [cleanRef]
      );
      await client.query('COMMIT');
      return {
        ok: false,
        httpStatus: 400,
        code: 'CUSTOMER_MISMATCH',
        tenantId,
        error: 'Payment customer email mismatch.'
      };
    }

    // 8. Record webhook event if invoked from webhook
    if (options.webhookEvent) {
      await client.query(
        `INSERT INTO webhook_events (id, provider, event_key, event_type, payload, status)
         VALUES ($1, 'paystack', $2, $3, $4, 'PROCESSED')
         ON CONFLICT (event_key) DO NOTHING`,
        [
          `whe_${crypto.randomUUID().slice(0, 8)}`,
          options.webhookEvent.eventKey,
          options.webhookEvent.eventType,
          JSON.stringify(options.webhookEvent.payload)
        ]
      );
    }

    // 9. Update payment record to SUCCESS, update tenant active plan, and create idempotent subscription
    const txId = options.webhookEvent?.transactionId || verifyRes.transactionId;
    const channel = options.webhookEvent?.channel || verifyRes.channel || 'online';
    const actorEmail =
      options.requireAuthorizedUser?.email ||
      payment.user_email ||
      options.webhookEvent?.customerEmail ||
      verifyRes.customerEmail ||
      'paystack@system';

    await client.query(
      `UPDATE payments
       SET status = 'SUCCESS',
           provider_transaction_id = $1,
           channel = $2,
           verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE provider_reference = $3`,
      [txId ? String(txId) : null, channel, cleanRef]
    );

    await client.query(
      'UPDATE tenants SET plan_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [planId, tenantId]
    );

    await client.query(
      `INSERT INTO subscriptions (
         id, tenant_id, plan_id, status, provider, payment_reference,
         user_email, current_period_start, current_period_end
       )
       VALUES (
         $1, $2, $3, 'active', 'paystack', $4,
         $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month'
       )
       ON CONFLICT (payment_reference) DO NOTHING`,
      [`sub_${crypto.randomUUID().slice(0, 8)}`, tenantId, planId, cleanRef, actorEmail]
    );

    await client.query('COMMIT');

    await logTenantAudit(tenantId, actorEmail, 'ACTIVATE_PAID_SUBSCRIPTION', 'subscription', planId, {
      reference: cleanRef,
      amount_kobo: verifyRes.amountKobo,
      currency: verifyRes.currency,
      plan_id: planId,
      source: options.source
    });

    const updated = await pool.query(
      `SELECT t.*, row_to_json(sp) as plan
       FROM tenants t
       LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
       WHERE t.id = $1`,
      [tenantId]
    );

    return {
      ok: true,
      httpStatus: 200,
      code: 'VERIFIED',
      alreadyProcessed: false,
      message: 'Payment verified and subscription activated successfully!',
      tenant: updated.rows[0],
      tenantId
    };
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// 28. POST /api/os/payments/initialize (Initialize verified Paystack subscription checkout)
businessOSRouter.post(
  '/payments/initialize',
  requireUserAuth,
  paymentRateLimit('paystack_init', 20, 60000),
  async (req: Request, res: Response) => {
    try {
      const user: SessionData = (req as any).user;
      const { tenant_id, plan_id } = req.body;

      if (!tenant_id || !plan_id) {
        return res.status(400).json({ error: 'tenant_id and plan_id are required' });
      }

      // Verify tenant ownership / admin privileges
      const tenantRes = await pool.query(
        'SELECT id, name, business_name, owner_email, plan_id FROM tenants WHERE id = $1',
        [tenant_id]
      );
      if (!tenantRes.rows.length) {
        return res.status(404).json({ error: 'Tenant organization not found' });
      }
      const tenant = tenantRes.rows[0];

      const isDirectOwner = tenant.owner_email && tenant.owner_email.toLowerCase() === user.email.toLowerCase();
      const isSuperAdmin = user.role === 'admin';
      if (!isDirectOwner && !isSuperAdmin) {
        const memberCheck = await pool.query(
          'SELECT role FROM tenant_members WHERE tenant_id = $1 AND LOWER(user_email) = LOWER($2) AND is_active = TRUE',
          [tenant_id, user.email]
        );
        if (!memberCheck.rows.length || (memberCheck.rows[0].role !== 'owner' && memberCheck.rows[0].role !== 'admin')) {
          return res.status(403).json({ error: 'Forbidden: Business owner privileges required for billing.' });
        }
      }

      // Resolve plan and exact price from database
      const planRes = await pool.query(
        'SELECT id, name, price_ngn, price_usd, is_active FROM subscription_plans WHERE id = $1',
        [plan_id]
      );
      if (!planRes.rows.length || !planRes.rows[0].is_active) {
        return res.status(404).json({ error: 'Selected subscription plan is invalid or inactive.' });
      }
      const plan = planRes.rows[0];

      if (plan.id === 'free' || Number(plan.price_ngn) === 0) {
        // Free plan requires no Paystack transaction
        await pool.query('UPDATE tenants SET plan_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['free', tenant_id]);
        await logTenantAudit(tenant_id, user.email, 'SWITCH_FREE_PLAN', 'subscription', 'free', { plan_id: 'free' });
        return res.json({
          success: true,
          isFreePlan: true,
          message: 'Free tier activated'
        });
      }

      // Calculate kobo amount and currency strictly on server from DB record and env configuration
      const amountKobo = Math.round(Number(plan.price_ngn) * 100);
      const paymentCurrency = getPaystackPaymentCurrency();
      const reference = `avt_${tenant_id.slice(0, 6)}_${plan_id}_${crypto.randomBytes(8).toString('hex')}`;

      // Check Paystack mode & configuration before creating checkout attempt (fail-closed on mismatch)
      const paystackCheck = validatePaystackModeAndKey();
      if (!paystackCheck.valid) {
        return res.status(503).json({
          error: process.env.NODE_ENV === 'production'
            ? 'Payment gateway is not available due to server configuration.'
            : (paystackCheck.error || 'Paystack is not configured on this server.')
        });
      }

      // Resolve authoritative server-side callback URL (PAYSTACK_CALLBACK_URL mandatory in production)
      let callbackUrl: string;
      try {
        callbackUrl = resolvePaystackCallbackUrl({
          origin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
          host: String(req.headers['x-forwarded-host'] || req.headers.host || ''),
          protocol: String(req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http'))
        });
      } catch (cfgErr: any) {
        return res.status(503).json({
          error: process.env.NODE_ENV === 'production'
            ? 'Payment gateway callback configuration is invalid.'
            : (cfgErr?.message || 'PAYSTACK_CALLBACK_URL configuration error.')
        });
      }

      // Record pending payment in database before initiating provider checkout
      const paymentId = `pay_${crypto.randomUUID().slice(0, 10)}`;
      await pool.query(
        `INSERT INTO payments (
           id, tenant_id, user_email, plan_id, provider, provider_reference,
           amount, amount_kobo, currency, payment_method, status, metadata
         )
         VALUES ($1, $2, $3, $4, 'paystack', $5, $6, $7, $8, 'ONLINE', 'PENDING', $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          paymentId,
          tenant_id,
          user.email,
          plan_id,
          reference,
          Number(plan.price_ngn),
          amountKobo,
          paymentCurrency,
          JSON.stringify({ tenant_name: tenant.name || tenant.business_name, plan_name: plan.name })
        ]
      );

      // Call real Paystack API to initialize transaction
      const initRes = await initializePaystackTransaction({
        email: user.email,
        amountKobo,
        reference,
        callbackUrl,
        metadata: {
          tenant_id,
          plan_id,
          user_email: user.email,
          payment_id: paymentId
        }
      });

      if (!initRes.success || !initRes.authorizationUrl) {
        await pool.query("UPDATE payments SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE provider_reference = $1", [reference]);
        return res.status(502).json({
          error: initRes.error || 'Failed to initialize payment with Paystack.'
        });
      }

      res.json({
        success: true,
        authorization_url: initRes.authorizationUrl,
        access_code: initRes.accessCode,
        reference: initRes.reference
      });
    } catch (err: any) {
      sendSafeRouterError(res, err, 'payments:initialize');
    }
  }
);

// 28b. GET /api/os/payments/paystack/callback (Customer Return Callback Route -> Server-Side Verification -> Billing Redirect)
businessOSRouter.get(
  '/payments/paystack/callback',
  paymentRateLimit('paystack_callback', 30, 60000),
  async (req: Request, res: Response) => {
    const rawRef = req.query.reference || req.query.trxref || req.query.ref;
    const refStr = Array.isArray(rawRef) ? String(rawRef[0] || '') : String(rawRef || '');

    if (!isValidPaystackReference(refStr)) {
      return res.redirect(302, '/business-os/billing?payment_error=invalid_reference');
    }

    const cleanRef = refStr.trim();

    try {
      const outcome = await verifyAndActivatePaystackPayment(cleanRef, {
        source: 'callback'
      });

      if (outcome.ok) {
        const params = new URLSearchParams({
          reference: cleanRef,
          payment_status: 'verified'
        });
        if (outcome.tenantId) {
          params.set('tenant', outcome.tenantId);
        }
        return res.redirect(302, `/business-os/billing?${params.toString()}`);
      }

      const errorCode = (outcome.code || 'verification_failed').toLowerCase();
      const params = new URLSearchParams({
        reference: cleanRef,
        payment_error: errorCode
      });
      return res.redirect(302, `/business-os/billing?${params.toString()}`);
    } catch (err: any) {
      console.error('[Paystack Callback Route Error]:', err?.message || err);
      const params = new URLSearchParams({
        reference: cleanRef,
        payment_error: 'verification_error'
      });
      return res.redirect(302, `/business-os/billing?${params.toString()}`);
    }
  }
);

// 29. POST /api/os/payments/verify (Authenticated Server-Side Paystack Verification & Idempotent Subscription Activation)
businessOSRouter.post(
  '/payments/verify',
  requireUserAuth,
  paymentRateLimit('paystack_verify', 30, 60000),
  async (req: Request, res: Response) => {
    try {
      const user: SessionData = (req as any).user;
      const { reference } = req.body;

      if (!reference || typeof reference !== 'string') {
        return res.status(400).json({ error: 'Payment reference is required.' });
      }

      const outcome = await verifyAndActivatePaystackPayment(reference, {
        source: 'verify',
        requireAuthorizedUser: user
      });

      if (!outcome.ok) {
        return res.status(outcome.httpStatus).json({
          success: false,
          code: outcome.code,
          error: outcome.error || 'Payment verification failed.'
        });
      }

      return res.json({
        success: true,
        alreadyProcessed: Boolean(outcome.alreadyProcessed),
        message: outcome.message || 'Payment verified and subscription activated successfully!',
        tenant: outcome.tenant
      });
    } catch (err: any) {
      sendSafeRouterError(res, err, 'payments:verify');
    }
  }
);

// 30. POST /api/os/payments/paystack/webhook (Separate Cryptographically Signed Paystack Webhook Handler)
businessOSRouter.post('/payments/paystack/webhook', async (req: Request, res: Response) => {
  try {
    const signatureHeader = req.headers['x-paystack-signature'];
    const rawBody = Buffer.isBuffer((req as any).rawBody)
      ? (req as any).rawBody
      : typeof (req as any).rawBody === 'string'
        ? Buffer.from((req as any).rawBody, 'utf8')
        : Buffer.isBuffer(req.body)
          ? req.body
          : undefined;

    if (!rawBody || rawBody.length === 0) {
      console.warn('[Paystack Webhook Security Alert]: Missing raw request body for HMAC-SHA512 verification.');
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    // 1. Verify HMAC-SHA512 cryptographic signature against PAYSTACK_SECRET_KEY
    const isValid = verifyPaystackWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      console.warn('[Paystack Webhook Security Alert]: Invalid or forged HMAC signature received.');
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    const event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
    if (!event || typeof event !== 'object' || typeof event.event !== 'string' || !event.event.trim()) {
      return res.status(400).json({ error: 'Malformed webhook event payload.' });
    }

    const eventType = event.event;
    const eventId = event.data?.id ? String(event.data.id) : (event.data?.reference || crypto.randomUUID());
    const eventKey = `paystack_${eventType}_${eventId}`;

    // 2. Deduplication check in webhook_events table
    const existingEvent = await pool.query(
      'SELECT id FROM webhook_events WHERE event_key = $1',
      [eventKey]
    );

    if (existingEvent.rows.length > 0) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    // 3. Handle charge.success via authoritative server-side verification
    if (eventType === 'charge.success') {
      const data = event.data || {};
      const reference = data.reference;

      if (!isValidPaystackReference(reference)) {
        await pool.query(
          `INSERT INTO webhook_events (id, provider, event_key, event_type, payload, status)
           VALUES ($1, 'paystack', $2, $3, $4, 'IGNORED')
           ON CONFLICT (event_key) DO NOTHING`,
          [`whe_${crypto.randomUUID().slice(0, 8)}`, eventKey, eventType, JSON.stringify(data)]
        );
        return res.status(200).json({ received: true, ignored: true });
      }

      const outcome = await verifyAndActivatePaystackPayment(reference, {
        source: 'webhook',
        webhookEvent: {
          eventKey,
          eventType,
          payload: data,
          transactionId: data.id,
          channel: data.channel,
          customerEmail: data.customer?.email
        }
      });

      if (!outcome.ok) {
        if (outcome.code === 'UNMATCHED') {
          console.warn(`[Paystack Webhook Alert]: Webhook reference ${reference} has no matching pending payment record.`);
          return res.status(200).json({ received: true, unmatched: true });
        }
        if (
          outcome.code === 'AMOUNT_MISMATCH' ||
          outcome.code === 'CURRENCY_MISMATCH' ||
          outcome.code === 'REFERENCE_MISMATCH' ||
          outcome.code === 'TENANT_MISMATCH' ||
          outcome.code === 'PLAN_MISMATCH' ||
          outcome.code === 'CUSTOMER_MISMATCH'
        ) {
          return res.status(400).json({ error: outcome.error || 'Payment mismatch' });
        }
        if (outcome.code === 'VERIFICATION_UNAVAILABLE') {
          return res.status(503).json({ error: 'Verification temporarily unavailable. Please retry.' });
        }
        return res.status(200).json({ received: true, verifyFailed: true, code: outcome.code });
      }

      if (outcome.alreadyProcessed) {
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }

      console.log(`[Paystack Webhook Success]: Activated subscription for tenant ${outcome.tenantId} via ref ${reference}`);
      return res.status(200).json({ received: true });
    }

    // Record unrelated event types safely without activating any subscription
    await pool.query(
      `INSERT INTO webhook_events (id, provider, event_key, event_type, payload, status)
       VALUES ($1, 'paystack', $2, $3, $4, 'UNHANDLED')
       ON CONFLICT (event_key) DO NOTHING`,
      [`whe_${crypto.randomUUID().slice(0, 8)}`, eventKey, eventType, JSON.stringify(event)]
    );

    return res.status(200).json({ received: true });
  } catch (err: any) {
    return sendSafeRouterError(res, err, 'payments:webhook');
  }
});

