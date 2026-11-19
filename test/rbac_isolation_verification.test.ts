import assert from 'assert';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import pool from '../lib/neon.js';
import { MIGRATIONS } from '../lib/migrations.js';
import { createSession, validateSession } from '../lib/serverAuth.js';

async function runRbacIsolationTests() {
  console.log('========================================================================');
  console.log('AVARTAH SOLUTIONS — CLIENT ACCESS ISOLATION, ADMIN UI & DB ID TESTS');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function check(cond: boolean, name: string, detail?: string) {
    if (cond) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const origEnv = { ...process.env };
  const origQuery = pool.query.bind(pool);
  const origConnect = pool.connect.bind(pool);

  const UUID_USER_A = '0f63999d-9b18-48e8-a5cd-d783842b933e';
  const INT_USER_B = 42;
  const INT_ADMIN_ID = 1;

  try {
    process.env.AVARTAH_TEST_MODE = '1';
    process.env.AVARTAH_SKIP_DB_INIT = '1';
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'c'.repeat(64);
    process.env.DATABASE_URL = 'postgresql://user:pass@ep-pooler.us-east-2.aws.neon.tech/db?sslmode=require';
    process.env.APP_BASE_URL = 'https://avartahs-solution.vercel.app';
    process.env.ALLOWED_ORIGINS = 'https://avartahs-solution.vercel.app';

    const adminHash = await bcrypt.hash('StrongAdminPass!2026', 10);
    const userHash = await bcrypt.hash('StrongClientPass!2026', 10);

    const sessions = new Map<string, any>();

    // Simulated persistent tables
    const adminUsers = [
      { id: INT_ADMIN_ID, email: 'admin@avartah.com', password_hash: adminHash, role: 'admin', is_active: true }
    ];
    const normalUsers = [
      { id: UUID_USER_A, email: 'clienta@example.com', password_hash: userHash, role: 'user', is_active: true },
      // Simulate tampered role column in users table -> backend must still treat as 'user'
      { id: INT_USER_B, email: 'clientb@example.com', password_hash: userHash, role: 'admin', is_active: true }
    ];

    const clientProjects = [
      {
        id: 'proj_alpha_uuid',
        name: 'Alpha E-Commerce Revamp',
        title: 'Alpha E-Commerce Revamp',
        client_id: 'clienta@example.com',
        client_user_id: UUID_USER_A,
        client_email: 'clienta@example.com',
        client_name: 'Client Alpha',
        description: 'Client Alpha project scope',
        scope: 'Storefront + Checkout',
        status: 'In Progress',
        start_date: '2026-01-01',
        target_date: '2026-03-01',
        completed_at: null,
        assigned_admin_id: '1',
        assigned_admin_name: 'Secret Internal Admin Name',
        prospect_id: 'prosp_secret_1',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'proj_beta_int',
        name: 'Beta CRM Automation',
        title: 'Beta CRM Automation',
        client_id: 'clientb@example.com',
        client_user_id: String(INT_USER_B),
        client_email: 'clientb@example.com',
        client_name: 'Client Beta',
        description: 'Client Beta confidential project',
        scope: 'CRM Hub',
        status: 'Planning',
        start_date: '2026-02-01',
        target_date: '2026-04-01',
        completed_at: null,
        assigned_admin_id: '1',
        assigned_admin_name: 'Secret Internal Admin Name',
        prospect_id: 'prosp_secret_2',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'proj_alpha_archived',
        name: 'Archived Alpha Project',
        title: 'Archived Alpha Project',
        client_id: 'clienta@example.com',
        client_user_id: UUID_USER_A,
        client_email: 'clienta@example.com',
        client_name: 'Client Alpha',
        description: 'Should not show up in active list',
        scope: 'Old',
        status: 'Completed',
        start_date: '2025-01-01',
        target_date: '2025-02-01',
        completed_at: new Date().toISOString(),
        assigned_admin_id: '1',
        assigned_admin_name: 'Secret Admin',
        is_archived: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const milestones = [
      {
        id: 'ms_1',
        project_id: 'proj_alpha_uuid',
        title: 'Architecture Blueprint',
        description: 'Core architecture',
        due_date: '2026-01-15',
        order_index: 0,
        status: 'Completed',
        notes: 'INTERNAL ADMIN NOTE: Client budget tight',
        client_notes: 'Approved blueprint',
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const deliverables = [
      {
        id: 'del_vis',
        project_id: 'proj_alpha_uuid',
        milestone_id: 'ms_1',
        title: 'Staging Preview',
        description: 'Live staging',
        type: 'Staging Link',
        resource_url: 'https://staging.example.com',
        visibility: 'client_visible',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'del_hidden',
        project_id: 'proj_alpha_uuid',
        milestone_id: 'ms_1',
        title: 'Internal Draft Spec',
        description: 'Draft only',
        type: 'Document',
        resource_url: 'https://internal.example.com',
        visibility: 'internal_draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const activities = [
      {
        id: 'act_vis',
        project_id: 'proj_alpha_uuid',
        type: 'general_update',
        message: 'Sprint 1 deployed to staging.',
        visibility: 'client_visible',
        author_email: 'admin@avartah.com',
        author_role: 'admin',
        created_at: new Date().toISOString()
      },
      {
        id: 'act_int',
        project_id: 'proj_alpha_uuid',
        type: 'internal_note',
        message: 'CONFIDENTIAL ADMIN MARGIN NOTE',
        visibility: 'internal_only',
        author_email: 'admin@avartah.com',
        author_role: 'admin',
        created_at: new Date().toISOString()
      }
    ];

    // Business OS fixtures
    const tenants = [
      { id: 'biz_a', name: 'Alpha Biz', business_name: 'Alpha Biz', owner_email: 'clienta@example.com', plan_id: 'free', status: 'ACTIVE' },
      { id: 'biz_b', name: 'Beta Biz', business_name: 'Beta Biz', owner_email: 'clientb@example.com', plan_id: 'free', status: 'ACTIVE' }
    ];
    const customers = [
      { id: 'cust_a', tenant_id: 'biz_a', name: 'Alpha Customer', email: 'acust@example.com', phone: '123' },
      { id: 'cust_b', tenant_id: 'biz_b', name: 'Beta Customer', email: 'bcust@example.com', phone: '456' }
    ];
    const invoices = [
      { id: 'inv_a', tenant_id: 'biz_a', invoice_number: 'INV-A1', customer_name: 'Alpha Customer', status: 'UNPAID', total_amount: 1000, amount_paid: 0, balance_due: 1000 },
      { id: 'inv_b', tenant_id: 'biz_b', invoice_number: 'INV-B1', customer_name: 'Beta Customer', status: 'UNPAID', total_amount: 2000, amount_paid: 0, balance_due: 2000 }
    ];
    const quotations = [
      { id: 'qte_a', tenant_id: 'biz_a', quotation_number: 'QTE-A1', customer_name: 'Alpha Customer', status: 'DRAFT', total_amount: 1500 },
      { id: 'qte_b', tenant_id: 'biz_b', quotation_number: 'QTE-B1', customer_name: 'Beta Customer', status: 'DRAFT', total_amount: 2500 }
    ];

    const mockQuery = async (text: string, params: any[] = []) => {
      const q = text.replace(/\s+/g, ' ').trim();

      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK' || q.startsWith('SET LOCAL')) {
        return { rows: [], rowCount: 0 };
      }
      if (q === 'SELECT 1') return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (q.startsWith('INSERT INTO rate_limit_events')) {
        return { rows: [{ count: 1, reset_time_ms: Date.now() + 60000 }], rowCount: 1 };
      }
      if (q.startsWith('SELECT count, EXTRACT(EPOCH FROM reset_time)') || q.startsWith('DELETE FROM rate_limit_events')) {
        return { rows: [], rowCount: 0 };
      }

      // Auth & Sessions
      if (q.includes('FROM admin_users WHERE LOWER(email) = LOWER($1)')) {
        const email = String(params[0] || '').toLowerCase();
        const found = adminUsers.filter(u => u.email.toLowerCase() === email);
        return { rows: found, rowCount: found.length };
      }
      if (q.includes('FROM users WHERE LOWER(email) = LOWER($1)')) {
        const email = String(params[0] || '').toLowerCase();
        const found = normalUsers.filter(u => u.email.toLowerCase() === email);
        return { rows: found, rowCount: found.length };
      }
      if (q.startsWith('INSERT INTO users')) {
        const newU = { id: 'new-uuid-' + (normalUsers.length + 1), email: params[0], password_hash: params[1], role: 'user', is_active: true };
        normalUsers.push(newU as any);
        return { rows: [newU], rowCount: 1 };
      }
      if (q.startsWith('INSERT INTO admin_sessions')) {
        sessions.set(params[0], { id: params[0], user_email: params[1], user_role: params[2], revoked: false });
        return { rows: [], rowCount: 1 };
      }
      if (q.startsWith('SELECT * FROM admin_sessions WHERE id = $1')) {
        const s = sessions.get(params[0]);
        if (s && !s.revoked) return { rows: [s], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }
      if (q.startsWith('UPDATE admin_sessions SET revoked = TRUE WHERE id = $1')) {
        const s = sessions.get(params[0]);
        if (s) s.revoked = true;
        return { rows: [], rowCount: 1 };
      }

      // Admin users CRUD (simulate PostgreSQL 22P02 if query lacked ::text when id is non-numeric!)
      if (q.includes('FROM admin_users WHERE id')) {
        if (!q.includes('id::text') && !/^\d+$/.test(String(params[0]))) {
          const err: any = new Error(`invalid input syntax for type integer: "${params[0]}"`);
          err.code = '22P02';
          throw err;
        }
        const found = adminUsers.filter(u => String(u.id) === String(params[0]));
        return { rows: found, rowCount: found.length };
      }
      if (q.includes('FROM users WHERE id')) {
        if (!q.includes('id::text') && !/^\d+$/.test(String(params[0]))) {
          const err: any = new Error(`invalid input syntax for type integer: "${params[0]}"`);
          err.code = '22P02';
          throw err;
        }
        const found = normalUsers.filter(u => String(u.id) === String(params[0]));
        return { rows: found, rowCount: found.length };
      }
      if (q.includes('FROM admin_users ORDER BY')) {
        return { rows: adminUsers.map(({ password_hash, ...rest }) => rest), rowCount: adminUsers.length };
      }
      if (q.includes('FROM users u') && q.includes('admin_sessions')) {
        return { rows: normalUsers.map(({ password_hash, ...rest }) => ({ ...rest, active_sessions: 1 })), rowCount: normalUsers.length };
      }

      // Client delivery projects list (must strictly use ::text on client_user_id or trigger 22P02!)
      if (q.includes('FROM client_projects p') && q.includes('project_milestones')) {
        const clientUserId = params[0];
        const clientEmail = String(params[1] || '').toLowerCase();
        if (clientUserId && !/^\d+$/.test(String(clientUserId)) && !q.includes('p.client_user_id::text')) {
          const err: any = new Error(`invalid input syntax for type integer: "${clientUserId}"`);
          err.code = '22P02';
          throw err;
        }
        const matched = clientProjects
          .filter(p => !p.is_archived && ((clientUserId !== null && String(p.client_user_id) === String(clientUserId)) || p.client_email.toLowerCase() === clientEmail))
          .map(p => ({
            id: p.id,
            name: p.name,
            client_name: p.client_name,
            client_email: p.client_email,
            description: p.description,
            scope: p.scope,
            status: p.status,
            start_date: p.start_date,
            target_date: p.target_date,
            completed_at: p.completed_at,
            created_at: p.created_at,
            updated_at: p.updated_at,
            total_milestones: milestones.filter(m => m.project_id === p.id).length,
            completed_milestones: milestones.filter(m => m.project_id === p.id && m.status === 'Completed').length
          }));
        return { rows: matched, rowCount: matched.length };
      }

      // Client single project detail or feedback ownership check
      if (q.includes('FROM client_projects WHERE id = $1') && q.includes('client_user_id')) {
        const projId = params[0];
        const clientUserId = params[1];
        const clientEmail = String(params[2] || '').toLowerCase();
        if (clientUserId && !/^\d+$/.test(String(clientUserId)) && !q.includes('client_user_id::text')) {
          const err: any = new Error(`invalid input syntax for type integer: "${clientUserId}"`);
          err.code = '22P02';
          throw err;
        }
        const found = clientProjects.filter(
          p =>
            p.id === projId &&
            !p.is_archived &&
            ((clientUserId !== null && String(p.client_user_id) === String(clientUserId)) || p.client_email.toLowerCase() === clientEmail)
        );
        if (q.startsWith('SELECT id, name, status')) {
          return { rows: found.map(p => ({ id: p.id, name: p.name, status: p.status })), rowCount: found.length };
        }
        return {
          rows: found.map(p => ({
            id: p.id,
            name: p.name,
            client_name: p.client_name,
            client_email: p.client_email,
            description: p.description,
            scope: p.scope,
            status: p.status,
            start_date: p.start_date,
            target_date: p.target_date,
            completed_at: p.completed_at,
            created_at: p.created_at,
            updated_at: p.updated_at
          })),
          rowCount: found.length
        };
      }

      if (q.includes('FROM project_milestones WHERE project_id = $1')) {
        const rows = milestones
          .filter(m => m.project_id === params[0])
          .map(({ notes, ...clientSafe }) => (q.includes('SELECT *') ? { notes, ...clientSafe } : clientSafe));
        return { rows, rowCount: rows.length };
      }

      if (q.includes('FROM project_deliverables WHERE project_id = $1')) {
        const clientVisibleOnly = q.includes("visibility = 'client_visible'");
        const rows = deliverables.filter(d => d.project_id === params[0] && (!clientVisibleOnly || d.visibility === 'client_visible'));
        return { rows, rowCount: rows.length };
      }

      if (q.includes('FROM project_activities WHERE project_id = $1')) {
        const clientVisibleOnly = q.includes("visibility = 'client_visible'");
        const rows = activities
          .filter(a => a.project_id === params[0] && (!clientVisibleOnly || a.visibility === 'client_visible'))
          .map(({ author_email, ...clientSafe }) => (q.includes('SELECT *') ? { author_email, ...clientSafe } : clientSafe));
        return { rows, rowCount: rows.length };
      }

      if (q.startsWith('INSERT INTO project_activities')) {
        activities.push({
          id: params[0],
          project_id: params[1],
          type: params[2],
          message: params[3],
          visibility: 'client_visible',
          author_email: params[4],
          author_role: 'client',
          created_at: new Date().toISOString()
        });
        return { rows: [], rowCount: 1 };
      }

      // Admin delivery list/detail
      if (q.includes('FROM client_projects') && q.includes('m.project_id = p.id') && !q.includes('p.client_user_id')) {
        return { rows: clientProjects, rowCount: clientProjects.length };
      }
      if (q.startsWith('SELECT * FROM client_projects')) {
        return { rows: clientProjects, rowCount: clientProjects.length };
      }
      if (q.includes('FROM client_projects WHERE (($1::text IS NOT NULL')) {
        const clientUserId = params[0];
        const clientEmail = String(params[1] || '').toLowerCase();
        const rows = clientProjects
          .filter(
            p =>
              !p.is_archived &&
              ((clientUserId !== null && String(p.client_user_id) === String(clientUserId)) ||
                p.client_email.toLowerCase() === clientEmail ||
                p.client_id.toLowerCase() === clientEmail)
          )
          .map(({ assigned_admin_id, assigned_admin_name, prospect_id, client_user_id, ...safe }) => safe);
        return { rows, rowCount: rows.length };
      }

      // Business OS queries
      if (q.includes('FROM tenants WHERE id = $1')) {
        const rows = tenants.filter(t => t.id === params[0]);
        return { rows, rowCount: rows.length };
      }
      if (q.includes('FROM tenant_members WHERE tenant_id = $1 AND LOWER(user_email) = LOWER($2)')) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes('FROM tenants t') && q.includes('ORDER BY t.created_at DESC')) {
        const rows = params.length === 0 ? tenants : tenants.filter(t => t.owner_email.toLowerCase() === String(params[0]).toLowerCase());
        return { rows, rowCount: rows.length };
      }
      if (q.includes('FROM invoices i') && q.includes('WHERE i.id = $1 AND i.tenant_id = $2')) {
        const rows = invoices.filter(i => i.id === params[0] && i.tenant_id === params[1]).map(i => ({ ...i, items: [], payments: [] }));
        return { rows, rowCount: rows.length };
      }
      if (q.includes('FROM invoices i') && q.includes('WHERE i.tenant_id = $1')) {
        const rows = invoices.filter(i => i.tenant_id === params[0]).map(i => ({ ...i, items: [], payments: [] }));
        return { rows, rowCount: rows.length };
      }
      if (q.includes('FROM quotations q') && q.includes('WHERE q.id = $1 AND q.tenant_id = $2')) {
        const rows = quotations.filter(qt => qt.id === params[0] && qt.tenant_id === params[1]).map(qt => ({ ...qt, items: [] }));
        return { rows, rowCount: rows.length };
      }
      if (q.includes('FROM quotations q') && q.includes('WHERE q.tenant_id = $1')) {
        const rows = quotations.filter(qt => qt.tenant_id === params[0]).map(qt => ({ ...qt, items: [] }));
        return { rows, rowCount: rows.length };
      }
      if (q.includes('FROM customers WHERE id = $1 AND tenant_id = $2')) {
        const rows = customers.filter(c => c.id === params[0] && c.tenant_id === params[1]);
        return { rows, rowCount: rows.length };
      }
      if (q.includes('FROM catalog_items WHERE id = $1 AND tenant_id = $2')) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes('FROM tenants t LEFT JOIN subscription_plans sp')) {
        return { rows: [{ plan_id: 'free', plan_name: 'Free', max_invoices_per_month: 100 }], rowCount: 1 };
      }
      if (q.includes('FROM invoices WHERE tenant_id = $1 AND created_at')) {
        return { rows: [{ count: 0 }], rowCount: 1 };
      }
      if (q.includes('SELECT COUNT(*) FROM site_analytics') || q.includes('FROM crm_leads') || q.includes('FROM site_analytics')) {
        return { rows: [{ count: 0, total_visitors: 0, avg_duration: 0, recent_visitors: 0, revenue: 0 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    };

    (pool as any).query = mockQuery;
    (pool as any).connect = async () => ({
      query: mockQuery,
      release: () => {}
    });

    const { default: app, startServer } = await import('../server.js');
    await startServer();

    // -------------------------------------------------------------------------
    // TEST 1 & 10: Normal User Login (UUID + tampered integer row) & Migration
    // -------------------------------------------------------------------------
    console.log('--- 1 & 10. Normal User Auth, Role Integrity, Migration 034 & UUID/Int Queries ---');

    const mig034 = MIGRATIONS.find(m => m.id === '034_reconcile_user_id_uuid_compatibility');
    check(Boolean(mig034 && mig034.sql.includes('client_user_id TYPE TEXT') && !/DROP\s+TABLE|TRUNCATE/i.test(mig034.sql)),
      'Migration 034 non-destructively converts user ID columns to TEXT without DROP TABLE / TRUNCATE');

    const loginARes = await request(app)
      .post('/api/auth/login')
      .set('Host', 'avartahs-solution.vercel.app')
      .send({ email: 'clienta@example.com', password: 'StrongClientPass!2026' });
    check(loginARes.status === 200 && loginARes.body?.user?.role === 'user' && loginARes.body?.user?.id === UUID_USER_A,
      'Normal user A with UUID id logs in cleanly as role="user"');

    // Login user B whose `users.role` row was tampered to `'admin'` -> must still receive `'user'`
    const loginBRes = await request(app)
      .post('/api/auth/login')
      .set('Host', 'avartahs-solution.vercel.app')
      .send({ email: 'clientb@example.com', password: 'StrongClientPass!2026' });
    check(loginBRes.status === 200 && loginBRes.body?.user?.role === 'user',
      'Tampered `users.role` row cannot escalate to admin at login (strictly role="user")');

    // Registration ignores any supplied role escalation attempt
    const regCsrf = loginARes.headers['x-csrf-token'] || '';
    const regRes = await request(app)
      .post('/api/auth/register')
      .set('Host', 'avartahs-solution.vercel.app')
      .set('x-csrf-token', regCsrf)
      .send({ email: 'newclient@example.com', password: 'StrongClientPass!2026', role: 'admin', is_active: true });
    check(regRes.status === 201 && regRes.body?.user?.role === 'user',
      'Signup ignores client-supplied role="admin" and creates user strictly with role="user"');

    const tokenA = await createSession('clienta@example.com', 'user');
    const tokenB = await createSession('clientb@example.com', 'user');
    const adminToken = await createSession('admin@avartah.com', 'admin');

    const validatedB = await validateSession(tokenB);
    check(validatedB !== null && validatedB.role === 'user',
      'validateSession derives role strictly from table membership (never trusts tampered users.role)');

    const sessARes = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${tokenA}`);
    check(
      sessARes.status === 200 &&
      sessARes.body?.authenticated === true &&
      sessARes.body?.user?.role === 'user' &&
      sessARes.headers['cache-control']?.includes('no-store'),
      'GET /api/auth/session returns role="user" with Cache-Control: no-store'
    );

    // -------------------------------------------------------------------------
    // TEST 2 & 3: Frontend RBAC Routing & Navigation Verification (Static Check)
    // -------------------------------------------------------------------------
    console.log('\n--- 2 & 3. Frontend Admin UI Hidden & Redirect Verification ---');

    const appSource = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');
    const footerSource = fs.readFileSync(path.join(process.cwd(), 'components/Footer.tsx'), 'utf8');
    const navbarSource = fs.readFileSync(path.join(process.cwd(), 'components/Navbar.tsx'), 'utf8');
    const portalSource = fs.readFileSync(path.join(process.cwd(), 'pages/ClientPortalPage.tsx'), 'utf8');
    const authLibSource = fs.readFileSync(path.join(process.cwd(), 'lib/auth.ts'), 'utf8');
    const bosContextSource = fs.readFileSync(path.join(process.cwd(), 'context/BusinessOSContext.tsx'), 'utf8');

    check(
      appSource.includes('<Navigate') && appSource.includes('to="/client/projects"') && !appSource.includes('Administrator privileges are strictly required. Your account does not have admin permissions'),
      'AdminRoute in App.tsx immediately redirects non-admin users to /client/projects'
    );
    check(
      footerSource.includes('isAdmin ?') && footerSource.includes("Admin Console"),
      'Footer conditionally hides Admin Console link unless isAdmin === true'
    );
    check(
      navbarSource.includes('isAdmin ?') && navbarSource.includes('Client Delivery Hub') && !navbarSource.includes('!isAdmin &&'),
      'Navbar separates Admin Console & Job Intelligence under isAdmin branch on both desktop & mobile'
    );
    check(
      portalSource.includes('p.name || p.title') &&
      portalSource.includes('p.target_date || p.target_end_date') &&
      portalSource.includes('deliv.resource_url || deliv.asset_url') &&
      portalSource.includes('/business-os/dashboard') &&
      !portalSource.includes('assigned_admin_name'),
      'ClientPortalPage maps API fields accurately, links to Business OS, and omits admin metadata'
    );
    check(
      authLibSource.includes('clearClientAuthCaches') && authLibSource.includes("cache: 'no-store'") &&
      bosContextSource.includes('useAuth') && bosContextSource.includes("localStorage.removeItem('avartah_active_tenant_id')"),
      'Frontend auth & BusinessOSContext clear stale caches/tenants on logout and user switch'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Normal User Blocked (403) on ALL Protected Admin Endpoints
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Normal User Blocked (403) on Admin API Endpoints ---');

    const adminEndpoints = [
      { method: 'get' as const, path: '/api/admin/users' },
      { method: 'post' as const, path: '/api/admin/users' },
      { method: 'get' as const, path: '/api/admin/registered-users' },
      { method: 'get' as const, path: '/api/admin/summary' },
      { method: 'get' as const, path: '/api/admin/delivery/projects' },
      { method: 'get' as const, path: '/api/leads' },
      { method: 'get' as const, path: '/api/prospects' },
      { method: 'get' as const, path: '/api/services-health' },
      { method: 'get' as const, path: '/api/proposals' },
      { method: 'get' as const, path: '/api/website-audits' },
      { method: 'get' as const, path: '/api/business-intelligence' }
    ];

    for (const ep of adminEndpoints) {
      const res = await request(app)[ep.method](ep.path).set('Authorization', `Bearer ${tokenA}`);
      check(res.status === 403 && res.headers['cache-control']?.includes('no-store'),
        `Normal user calling ${ep.method.toUpperCase()} ${ep.path} returns 403 + no-store (got ${res.status})`);
    }

    // -------------------------------------------------------------------------
    // TEST 5 & 10: Client Delivery Projects UUID/Integer & Zero Admin Leak
    // -------------------------------------------------------------------------
    console.log('\n--- 5 & 10. Client Sees Only Own Projects (UUID & Integer IDs, Zero Admin Leakage) ---');

    const projListA = await request(app)
      .get('/api/client/delivery/projects')
      .set('Authorization', `Bearer ${tokenA}`);
    check(
      projListA.status === 200 &&
      Array.isArray(projListA.body) &&
      projListA.body.length === 1 &&
      projListA.body[0].id === 'proj_alpha_uuid' &&
      !('assigned_admin_name' in projListA.body[0]) &&
      !('assigned_admin_id' in projListA.body[0]),
      'GET /api/client/delivery/projects succeeds with UUID userId, filters archived/foreign rows, and omits admin fields'
    );

    const projListB = await request(app)
      .get('/api/client/delivery/projects')
      .set('Authorization', `Bearer ${tokenB}`);
    check(
      projListB.status === 200 &&
      Array.isArray(projListB.body) &&
      projListB.body.length === 1 &&
      projListB.body[0].id === 'proj_beta_int',
      'GET /api/client/delivery/projects succeeds with integer userId'
    );

    const projDetailA = await request(app)
      .get('/api/client/delivery/projects/proj_alpha_uuid')
      .set('Authorization', `Bearer ${tokenA}`);
    const detailJson = JSON.stringify(projDetailA.body || {});
    check(
      projDetailA.status === 200 &&
      !('assigned_admin_name' in projDetailA.body) &&
      !detailJson.includes('Secret Internal Admin Name') &&
      !detailJson.includes('INTERNAL ADMIN NOTE') &&
      !detailJson.includes('CONFIDENTIAL ADMIN MARGIN NOTE') &&
      !detailJson.includes('admin@avartah.com') &&
      projDetailA.body?.deliverables?.length === 1 &&
      projDetailA.body?.activities?.length === 1,
      'GET /api/client/delivery/projects/:id omits admin names, emails, internal notes, and draft deliverables'
    );

    const legacyProjectsA = await request(app)
      .get('/api/client-projects')
      .set('Authorization', `Bearer ${tokenA}`);
    check(
      legacyProjectsA.status === 200 &&
      legacyProjectsA.body.length === 1 &&
      !('assigned_admin_name' in legacyProjectsA.body[0]) &&
      !('prospect_id' in legacyProjectsA.body[0]),
      'GET /api/client-projects enforces strict client isolation and strips admin/prospect fields'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Cross-User Project IDOR Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Cross-User Project Detail & Feedback IDOR Blocked ---');

    const idorDetail = await request(app)
      .get('/api/client/delivery/projects/proj_beta_int')
      .set('Authorization', `Bearer ${tokenA}`);
    check(idorDetail.status === 404, `Cross-user GET /api/client/delivery/projects/proj_beta_int returns 404 (got ${idorDetail.status})`);

    const nonExistentProj = await request(app)
      .get('/api/client/delivery/projects/nonexistent-id-999')
      .set('Authorization', `Bearer ${tokenA}`);
    check(nonExistentProj.status === 404, `Nonexistent project returns 404 cleanly (got ${nonExistentProj.status})`);

    const idorFeedback = await request(app)
      .post('/api/client/delivery/projects/proj_beta_int/feedback')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'Trying to tamper Beta project', type: 'revision_request' });
    check(idorFeedback.status === 404, `Cross-user feedback POST returns 404 (got ${idorFeedback.status})`);

    // -------------------------------------------------------------------------
    // TEST 7: Cross-Tenant Business OS Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Cross-Tenant Business OS Invoice & Quotation Isolation ---');

    const listTenantsA = await request(app).get('/api/os/tenants').set('Authorization', `Bearer ${tokenA}`);
    check(
      listTenantsA.status === 200 && listTenantsA.body.length === 1 && listTenantsA.body[0].id === 'biz_a',
      'User A lists only own Business OS tenant (biz_a)'
    );

    const crossTenantInvList = await request(app).get('/api/os/biz_b/invoices').set('Authorization', `Bearer ${tokenA}`);
    check(crossTenantInvList.status === 403, `Cross-tenant GET /api/os/biz_b/invoices returns 403 (got ${crossTenantInvList.status})`);

    const crossTenantQteList = await request(app).get('/api/os/biz_b/quotations').set('Authorization', `Bearer ${tokenA}`);
    check(crossTenantQteList.status === 403, `Cross-tenant GET /api/os/biz_b/quotations returns 403 (got ${crossTenantQteList.status})`);

    const crossIdInv = await request(app).get('/api/os/biz_a/invoices/inv_b').set('Authorization', `Bearer ${tokenA}`);
    check(crossIdInv.status === 404, `Own-tenant lookup of foreign invoice ID returns 404 (got ${crossIdInv.status})`);

    const crossIdQte = await request(app).get('/api/os/biz_a/quotations/qte_b').set('Authorization', `Bearer ${tokenA}`);
    check(crossIdQte.status === 404, `Own-tenant lookup of foreign quotation ID returns 404 (got ${crossIdQte.status})`);

    const crossCustInvCreate = await request(app)
      .post('/api/os/biz_a/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ customer_id: 'cust_b', customer_name: 'Spoofed Name', items: [] });
    check(crossCustInvCreate.status === 400,
      `Creating invoice with foreign customer_id (even with customer_name present) rejected with 400 (got ${crossCustInvCreate.status})`);

    const crossCustQteCreate = await request(app)
      .post('/api/os/biz_a/quotations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ customer_id: 'cust_b', customer_name: 'Spoofed Name', items: [] });
    check(crossCustQteCreate.status === 400,
      `Creating quotation with foreign customer_id (even with customer_name present) rejected with 400 (got ${crossCustQteCreate.status})`);

    // -------------------------------------------------------------------------
    // TEST 8: Admin Retains Full Authorized Access & Malformed ID Safety
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Admin Access Preserved & Safe ID Handling ---');

    const adminUsersRes = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);
    check(adminUsersRes.status === 200 && Array.isArray(adminUsersRes.body), 'Admin retains access to /api/admin/users');

    const adminSvcRes = await request(app).get('/api/services-health').set('Authorization', `Bearer ${adminToken}`);
    check(adminSvcRes.status === 200, 'Admin retains access to /api/services-health');

    const adminBadUuid = await request(app)
      .patch('/api/admin/users/0f63999d-9b18-48e8-a5cd-d783842b933e')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: true });
    check(adminBadUuid.status === 404, `Admin PATCH /api/admin/users/<nonexistent-uuid> returns clean 404 instead of 500/22P02 (got ${adminBadUuid.status})`);

    const adminRegBadId = await request(app)
      .post('/api/admin/registered-users/not-found-uuid/revoke-sessions')
      .set('Authorization', `Bearer ${adminToken}`);
    check(adminRegBadId.status === 404, `Admin revoke-sessions on nonexistent UUID returns clean 404 (got ${adminRegBadId.status})`);

    // -------------------------------------------------------------------------
    // TEST 9: Logout Session Revocation
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Logout Revokes Session & Blocks Replay ---');

    const tempToken = await createSession('clienta@example.com', 'user');
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tempToken}`);
    check(logoutRes.status === 200 && logoutRes.headers['cache-control']?.includes('no-store'),
      'POST /api/auth/logout succeeds with Cache-Control: no-store');

    const postLogoutCall = await request(app)
      .get('/api/client/delivery/projects')
      .set('Authorization', `Bearer ${tempToken}`);
    check(postLogoutCall.status === 401, `Revoked token rejected with 401 after logout (got ${postLogoutCall.status})`);

  } finally {
    (pool as any).query = origQuery;
    (pool as any).connect = origConnect;
    process.env = origEnv;
  }

  console.log('\n========================================================================');
  console.log(`RBAC & ISOLATION TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('========================================================================');
  assert.strictEqual(failed, 0, `${failed} verification check(s) failed`);
}

runRbacIsolationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
