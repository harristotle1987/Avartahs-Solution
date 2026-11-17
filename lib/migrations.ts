import pool from './neon.js';

interface Migration {
  id: string;
  description: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    id: '001_core_accounts_and_sessions',
    description: 'Create admin_users, users, admin_sessions, and system_settings tables',
    sql: `
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        user_role TEXT DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked BOOLEAN DEFAULT FALSE,
        ip_address TEXT,
        user_agent TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(user_email);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    id: '002_crm_and_prospects',
    description: 'Create crm_leads, prospects, and prospects_excluded tables and indexes',
    sql: `
      CREATE TABLE IF NOT EXISTS crm_leads (
        id TEXT PRIMARY KEY,
        contact_name TEXT,
        business_name TEXT,
        user_email TEXT,
        user_phone TEXT,
        target_url TEXT,
        website TEXT,
        country TEXT,
        city TEXT,
        timezone TEXT,
        requested_service TEXT,
        lead_source TEXT DEFAULT 'Website Enquiry',
        status TEXT DEFAULT 'New',
        priority TEXT DEFAULT 'Medium',
        assigned_admin TEXT,
        notes TEXT,
        follow_up_date TIMESTAMP WITH TIME ZONE,
        last_contacted_at TIMESTAMP WITH TIME ZONE,
        revenue_tier TEXT,
        core_problem TEXT,
        cta_source TEXT,
        session_id TEXT,
        workspace_id TEXT DEFAULT 'ws_default_legacy',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON crm_leads(user_email);
      CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
      CREATE INDEX IF NOT EXISTS idx_crm_leads_source ON crm_leads(lead_source);
      CREATE INDEX IF NOT EXISTS idx_crm_leads_created ON crm_leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_crm_leads_ws ON crm_leads(workspace_id);

      CREATE TABLE IF NOT EXISTS prospects (
        id TEXT PRIMARY KEY,
        business_name TEXT,
        business_category TEXT,
        niche TEXT,
        location TEXT,
        location_coords JSONB,
        phone TEXT,
        email TEXT,
        website_url TEXT,
        status TEXT,
        ai_draft TEXT,
        email_draft TEXT,
        whatsapp_draft TEXT,
        source TEXT,
        source_provenance JSONB,
        contact_evidence JSONB,
        verification_status TEXT,
        website_availability TEXT,
        website_quality_score INTEGER,
        website_quality_category TEXT,
        website_evidence TEXT,
        whatsapp_link TEXT,
        qualification_status TEXT DEFAULT 'QUALIFIED',
        reviewed_status TEXT DEFAULT 'PENDING',
        crm_lead_id TEXT,
        promoted_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        rejection_reason TEXT,
        category TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_provenance JSONB;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_evidence JSONB;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS verification_status TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS website_availability TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS website_quality_score INTEGER;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS website_quality_category TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS website_evidence TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS whatsapp_link TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'QUALIFIED';
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reviewed_status TEXT DEFAULT 'PENDING';
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS crm_lead_id TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS category TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_prospects_phone ON prospects(phone);
      CREATE INDEX IF NOT EXISTS idx_prospects_website ON prospects(LOWER(website_url));
      CREATE INDEX IF NOT EXISTS idx_prospects_reviewed ON prospects(reviewed_status);
      CREATE INDEX IF NOT EXISTS idx_prospects_crm_lead ON prospects(crm_lead_id);
      CREATE INDEX IF NOT EXISTS idx_prospects_created ON prospects(created_at);

      CREATE TABLE IF NOT EXISTS prospects_excluded (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        reason TEXT,
        source TEXT,
        retry_status TEXT DEFAULT 'PENDING_RETRY',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    id: '003_jobs_and_saved_jobs',
    description: 'Create jobs and saved_jobs tables with unique user-job constraint',
    sql: `
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT,
        country TEXT,
        remote_status TEXT,
        description TEXT,
        employment_type TEXT,
        salary_min NUMERIC,
        salary_max NUMERIC,
        currency TEXT,
        pay_period TEXT,
        posted_at TIMESTAMP WITH TIME ZONE,
        discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        application_url TEXT,
        source_name TEXT,
        source_job_id TEXT,
        status TEXT DEFAULT 'ACTIVE',
        verification_evidence TEXT,
        match_score INTEGER,
        match_reason TEXT,
        first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        source_provenance JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS saved_jobs (
        id SERIAL PRIMARY KEY,
        user_email TEXT NOT NULL,
        job_id TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'BOOKMARKED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_job UNIQUE (user_email, job_id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_jobs_user_job ON saved_jobs(user_email, job_id);
    `
  },
  {
    id: '004_delivery_hub_and_workspaces',
    description: 'Create client_projects, milestones, deliverables, activities, and workspaces',
    sql: `
      CREATE TABLE IF NOT EXISTS client_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        client_user_id INTEGER,
        client_email TEXT NOT NULL,
        client_name TEXT,
        description TEXT,
        scope TEXT,
        status TEXT NOT NULL DEFAULT 'Planning',
        start_date DATE,
        target_date DATE,
        completed_at TIMESTAMP WITH TIME ZONE,
        assigned_admin_id INTEGER,
        assigned_admin_name TEXT,
        is_archived BOOLEAN DEFAULT FALSE,
        workspace_id TEXT DEFAULT 'ws_default_legacy',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_client_projects_email ON client_projects(LOWER(client_email));
      CREATE INDEX IF NOT EXISTS idx_client_projects_user_id ON client_projects(client_user_id);
      CREATE INDEX IF NOT EXISTS idx_client_projects_status ON client_projects(status);
      CREATE INDEX IF NOT EXISTS idx_client_projects_ws ON client_projects(workspace_id);

      CREATE TABLE IF NOT EXISTS project_milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        due_date DATE,
        order_index INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Not Started',
        notes TEXT,
        client_notes TEXT,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id);
      CREATE INDEX IF NOT EXISTS idx_milestones_status ON project_milestones(status);

      CREATE TABLE IF NOT EXISTS project_deliverables (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
        milestone_id TEXT REFERENCES project_milestones(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'Document',
        resource_url TEXT,
        visibility TEXT NOT NULL DEFAULT 'client_visible',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_deliverables_project ON project_deliverables(project_id);

      CREATE TABLE IF NOT EXISTS project_activities (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'client_visible',
        author_email TEXT NOT NULL,
        author_role TEXT NOT NULL DEFAULT 'admin',
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_activities_project ON project_activities(project_id);

      CREATE TABLE IF NOT EXISTS ai_automation_logs (
        id TEXT PRIMARY KEY,
        automation_type TEXT NOT NULL,
        user_email TEXT NOT NULL,
        user_role TEXT,
        provider TEXT DEFAULT 'gemini-3.8-flash',
        model_used TEXT DEFAULT 'gemini-3.8-flash',
        input_summary TEXT,
        output_summary TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        execution_time_ms INTEGER,
        workspace_id TEXT DEFAULT 'ws_default_legacy',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_automation_logs(user_email);
      CREATE INDEX IF NOT EXISTS idx_ai_logs_ws ON ai_automation_logs(workspace_id);

      CREATE TABLE IF NOT EXISTS ai_usage_quotas (
        user_email TEXT PRIMARY KEY,
        requests_today INTEGER DEFAULT 0,
        last_request_date DATE DEFAULT CURRENT_DATE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS workspace_memberships (
        id SERIAL PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_email)
      );
      CREATE INDEX IF NOT EXISTS idx_workspace_members_email ON workspace_memberships(LOWER(user_email));
      CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON workspace_memberships(workspace_id);

      CREATE TABLE IF NOT EXISTS workspace_subscriptions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL DEFAULT 'free',
        status TEXT NOT NULL DEFAULT 'active',
        billing_interval TEXT DEFAULT 'monthly',
        current_period_end TIMESTAMP WITH TIME ZONE,
        provider_subscription_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_ws_sub_workspace UNIQUE (workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_workspace_subs_ws ON workspace_subscriptions(workspace_id);

      CREATE TABLE IF NOT EXISTS workspace_invitations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        inviter_email TEXT NOT NULL,
        invitee_email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ws_invitations_token ON workspace_invitations(token_hash);
      CREATE INDEX IF NOT EXISTS idx_ws_invitations_email ON workspace_invitations(LOWER(invitee_email));
    `
  },
  {
    id: '005_bookings_and_password_recovery',
    description: 'Create bookings with unique slot constraint and password_reset_tokens table',
    sql: `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_pwd_reset_email ON password_reset_tokens(LOWER(user_email));
      CREATE INDEX IF NOT EXISTS idx_pwd_reset_hash ON password_reset_tokens(token_hash);

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        booking_date DATE NOT NULL,
        booking_time TEXT NOT NULL,
        client_name TEXT,
        client_email TEXT,
        client_phone TEXT,
        service_requested TEXT,
        notes TEXT,
        status TEXT DEFAULT 'CONFIRMED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_booking_slot UNIQUE (booking_date, booking_time)
      );
      CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
      CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(LOWER(client_email));
    `
  },
  {
    id: '006_projects_and_blogs',
    description: 'Create projects and blogs tables with proper visibility, archiving, and published columns',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subtitle TEXT,
        category TEXT,
        description TEXT,
        client TEXT,
        duration TEXT,
        impact TEXT,
        metrics JSONB,
        image_url TEXT,
        tags TEXT[],
        demo_url TEXT,
        github_url TEXT,
        media JSONB,
        is_archived BOOLEAN DEFAULT FALSE,
        visibility TEXT DEFAULT 'public',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
      CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(is_archived);
      CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);

      CREATE TABLE IF NOT EXISTS blogs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        excerpt TEXT,
        content TEXT NOT NULL,
        author TEXT,
        category TEXT DEFAULT 'Engineering',
        cover_image TEXT,
        published BOOLEAN DEFAULT TRUE,
        published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS author TEXT;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT TRUE;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS cover_image TEXT;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS excerpt TEXT;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Engineering';
      CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);
      CREATE INDEX IF NOT EXISTS idx_blogs_published ON blogs(published);
    `
  },
  {
    id: '007_analytics_webhooks_and_rate_limits',
    description: 'Create site_analytics, analytics_events, outreach_templates, processed_webhook_events, and rate_limit_events',
    sql: `
      CREATE TABLE IF NOT EXISTS site_analytics (
        id TEXT PRIMARY KEY,
        visitor_id TEXT NOT NULL,
        user_email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        referrer TEXT,
        session_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        duration_seconds INTEGER DEFAULT 0,
        page_views INTEGER DEFAULT 1,
        form_progress INTEGER DEFAULT 0,
        submitted BOOLEAN DEFAULT FALSE,
        is_pricing_sensitive BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_site_analytics_visitor ON site_analytics(visitor_id);
      CREATE INDEX IF NOT EXISTS idx_site_analytics_start ON site_analytics(session_start DESC);

      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        visitor_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data JSONB,
        step INTEGER,
        form_progress INTEGER,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor ON analytics_events(visitor_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics_events(timestamp DESC);

      CREATE TABLE IF NOT EXISTS outreach_templates (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        system_prompt TEXT,
        category TEXT,
        variables TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS processed_webhook_events (
        id TEXT PRIMARY KEY,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_processed_webhooks_at ON processed_webhook_events(processed_at);

      CREATE TABLE IF NOT EXISTS rate_limit_events (
        key TEXT PRIMARY KEY,
        count INTEGER DEFAULT 1,
        reset_time TIMESTAMP WITH TIME ZONE NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_events(reset_time);
    `
  },
  {
    id: '008_historical_data_reconciliation',
    description: 'Reconcile legacy audit_submissions into crm_leads and session_bookings into bookings',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_submissions') THEN
          INSERT INTO crm_leads (id, user_email, user_phone, target_url, revenue_tier, core_problem, cta_source, session_id, lead_source, status, created_at)
          SELECT id, user_email, user_phone, target_url, revenue_tier, core_problem, cta_source, session_id, 'Audit Submission', 'New', created_at
          FROM audit_submissions
          ON CONFLICT (id) DO NOTHING;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session_bookings') THEN
          INSERT INTO bookings (id, booking_date, booking_time, client_name, client_email, notes, status, created_at)
          SELECT id, TO_DATE(booking_date, 'DD/MM/YYYY'), booking_time, COALESCE(name, 'Valued Client'), email, message, 'CONFIRMED', created_at
          FROM session_bookings
          WHERE booking_date IS NOT NULL AND booking_time IS NOT NULL AND booking_date ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          ON CONFLICT (booking_date, booking_time) DO NOTHING;
        END IF;
      END $$;
    `
  },
  {
    id: '009_prospect_outreach_and_quality_upgrade',
    description: 'Add outreach_status, suggested_service, and outreach tracking columns to prospects',
    sql: `
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS suggested_service TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_status TEXT DEFAULT 'NOT_CONTACTED';
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_outreach_channel TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_outreach_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_count INT DEFAULT 0;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_notes TEXT;
      CREATE INDEX IF NOT EXISTS idx_prospects_outreach_status ON prospects(outreach_status);
      CREATE INDEX IF NOT EXISTS idx_prospects_business_name_loc ON prospects(business_name, location);
    `
  },
  {
    id: '010_audit_logs_and_crm_foreign_key',
    description: 'Create prospect_audit_logs table, automated triggers, and CRM foreign key relation',
    sql: `
      CREATE TABLE IF NOT EXISTS prospect_audit_logs (
          id SERIAL PRIMARY KEY,
          prospect_id TEXT,
          action_type TEXT NOT NULL,
          old_state JSONB,
          new_state JSONB,
          performed_by TEXT DEFAULT 'system',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_prospect_audit_prospect_id ON prospect_audit_logs(prospect_id);
      CREATE INDEX IF NOT EXISTS idx_prospect_audit_created_at ON prospect_audit_logs(created_at);

      CREATE OR REPLACE FUNCTION update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE OR REPLACE FUNCTION log_prospect_changes()
      RETURNS TRIGGER AS $$
      BEGIN
          IF (TG_OP = 'INSERT') THEN
              INSERT INTO prospect_audit_logs (prospect_id, action_type, new_state)
              VALUES (NEW.id, 'INSERT', to_jsonb(NEW));
              RETURN NEW;
          ELSIF (TG_OP = 'UPDATE') THEN
              INSERT INTO prospect_audit_logs (prospect_id, action_type, old_state, new_state)
              VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
              RETURN NEW;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_prospects_updated_at ON prospects;
      CREATE TRIGGER trigger_prospects_updated_at
          BEFORE UPDATE ON prospects
          FOR EACH ROW
          EXECUTE FUNCTION update_modified_column();

      DROP TRIGGER IF EXISTS trigger_prospects_audit ON prospects;
      CREATE TRIGGER trigger_prospects_audit
          AFTER INSERT OR UPDATE ON prospects
          FOR EACH ROW
          EXECUTE FUNCTION log_prospect_changes();
    `
  },
  {
    id: '011_avartah_platform_growth_upgrade',
    description: 'Create tables for website audits, proposals, client projects, website monitoring, industry templates, and AI action logs',
    sql: `
      CREATE TABLE IF NOT EXISTS website_audits (
        id TEXT PRIMARY KEY,
        prospect_id TEXT,
        client_id TEXT,
        url TEXT NOT NULL,
        performance_score INTEGER DEFAULT 0,
        accessibility_score INTEGER DEFAULT 0,
        seo_score INTEGER DEFAULT 0,
        mobile_score INTEGER DEFAULT 0,
        overall_score INTEGER DEFAULT 0,
        opportunity_score INTEGER DEFAULT 0,
        opportunity_category TEXT,
        evidence_json JSONB,
        pdf_report_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_website_audits_prospect ON website_audits(prospect_id);
      CREATE INDEX IF NOT EXISTS idx_website_audits_url ON website_audits(url);

      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        prospect_id TEXT,
        client_id TEXT,
        title TEXT NOT NULL,
        executive_summary TEXT,
        problem_statement TEXT,
        proposed_solutions TEXT,
        deliverables TEXT,
        timeline_weeks INTEGER DEFAULT 4,
        total_amount NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        maintenance_options TEXT,
        terms_and_conditions TEXT,
        status TEXT DEFAULT 'DRAFT',
        created_by TEXT,
        approved_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_proposals_prospect ON proposals(prospect_id);
      CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

      CREATE TABLE IF NOT EXISTS client_projects (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        prospect_id TEXT,
        title TEXT,
        description TEXT,
        status TEXT DEFAULT 'ACTIVE',
        current_milestone TEXT,
        budget NUMERIC DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS client_id TEXT;
      ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS prospect_id TEXT;
      ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS current_milestone TEXT;
      ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS budget NUMERIC DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_client_projects_client ON client_projects(client_id);

      CREATE TABLE IF NOT EXISTS project_milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES client_projects(id) ON DELETE CASCADE,
        title TEXT,
        description TEXT,
        status TEXT DEFAULT 'PENDING',
        due_date TIMESTAMP WITH TIME ZONE
      );
      ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
      ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;
      CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);

      CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES client_projects(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        file_url TEXT NOT NULL,
        uploaded_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS project_communications (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES client_projects(id) ON DELETE CASCADE,
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS project_invoices (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES client_projects(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        status TEXT DEFAULT 'PENDING',
        due_date TIMESTAMP WITH TIME ZONE,
        invoice_number TEXT UNIQUE
      );

      CREATE TABLE IF NOT EXISTS website_monitors (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        url TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        check_interval_minutes INTEGER DEFAULT 60,
        last_checked_at TIMESTAMP WITH TIME ZONE,
        http_status INTEGER,
        ssl_expiry_date TIMESTAMP WITH TIME ZONE,
        response_time_ms INTEGER,
        uptime_percentage NUMERIC DEFAULT 100.0,
        incidents_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_website_monitors_active ON website_monitors(is_active);

      CREATE TABLE IF NOT EXISTS monitor_incidents (
        id TEXT PRIMARY KEY,
        monitor_id TEXT REFERENCES website_monitors(id) ON DELETE CASCADE,
        incident_type TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'OPEN',
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS industry_templates (
        id TEXT PRIMARY KEY,
        industry_name TEXT UNIQUE NOT NULL,
        common_problems TEXT[],
        recommended_features TEXT[],
        optional_automation TEXT[],
        required_integrations TEXT[],
        page_sections TEXT[],
        suggested_packages TEXT[]
      );

      CREATE TABLE IF NOT EXISTS ai_action_logs (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        prompt_context TEXT,
        ai_response TEXT,
        approved_by TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Seed default industry templates
      INSERT INTO industry_templates (id, industry_name, common_problems, recommended_features, optional_automation, required_integrations, page_sections, suggested_packages)
      VALUES 
      ('ind_salon', 'Salons and Spas', ARRAY['Manual appointment scheduling', 'No-show rates', 'Lack of loyalty retention'], ARRAY['Online booking widget', 'Service menu', 'Staff portfolio', 'Review showcase'], ARRAY['SMS appointment reminders', 'Automated feedback requests'], ARRAY['Stripe / Paystack', 'WhatsApp notifications'], ARRAY['Hero', 'Services', 'Stylists', 'Booking', 'Reviews'], ARRAY['Tier Alpha', 'Tier Beta']),
      ('ind_restaurant', 'Restaurants and Eateries', ARRAY['High commission third-party food apps', 'Outdated PDF menus', 'No direct table reservations'], ARRAY['Interactive digital menu', 'Table reservation system', 'Online ordering', 'Daily specials'], ARRAY['Order status notifications', 'Kitchen display sync'], ARRAY['Payment gateway', 'POS sync'], ARRAY['Hero', 'Menu', 'Reservations', 'Gallery', 'Contact'], ARRAY['Tier Alpha', 'Tier Beta']),
      ('ind_law', 'Law Firms', ARRAY['Low digital trust', 'Unclear intake pipelines', 'Generic contact forms'], ARRAY['Secure client consultation booking', 'Practice area breakdown', 'Client testimonials', 'Secure document upload portal'], ARRAY['Automated lead routing', 'Initial intake screening'], ARRAY['Calendly / Secure Booking', 'Encrypted File Storage'], ARRAY['Hero', 'Practice Areas', 'Attorneys', 'Case Results', 'Contact'], ARRAY['Tier Beta', 'Tier Gamma']),
      ('ind_retail', 'Furniture and Retail', ARRAY['Poor mobile ecommerce UX', 'High cart abandonment', 'Inventory sync issues'], ARRAY['High-speed e-commerce store', 'Product zoom & 3D viewer', 'Customer account portal', 'Wishlist & cart'], ARRAY['Abandoned cart email recovery', 'Inventory low-stock alerts'], ARRAY['Payment gateway', 'Shipping APIs'], ARRAY['Hero', 'Featured Products', 'Categories', 'Showroom', 'Checkout'], ARRAY['Tier Beta', 'Tier Gamma'])
      ON CONFLICT (id) DO NOTHING;
    `
  },
  {
    id: '021_crm_outreach_history_and_prospect_outreach_status',
    description: 'Add crm_outreach_history table and prospect deep scrape & outreach audit fields',
    sql: `
      CREATE TABLE IF NOT EXISTS crm_outreach_history (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        prospect_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT,
        message_body TEXT NOT NULL,
        dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        operator_email TEXT DEFAULT 'admin@avartah.com'
      );

      CREATE INDEX IF NOT EXISTS idx_crm_outreach_prospect ON crm_outreach_history(prospect_id);
      CREATE INDEX IF NOT EXISTS idx_crm_outreach_dispatched ON crm_outreach_history(dispatched_at);
      CREATE INDEX IF NOT EXISTS idx_crm_outreach_channel ON crm_outreach_history(channel);

      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_status TEXT DEFAULT 'UNCONTACTED';
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_outreach_channel TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_outreach_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_count INTEGER DEFAULT 0;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS deep_scraped_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_evidence JSONB;
    `
  },
  {
    id: '022_business_os_saas',
    description: 'Create multi-tenant SaaS tables for Avartah Business OS (tenants, members, customers, catalog, invoices, payments, subscriptions)',
    sql: `
      -- 1. Subscription Plans
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tagline TEXT,
        price_ngn NUMERIC NOT NULL DEFAULT 0,
        price_usd NUMERIC NOT NULL DEFAULT 0,
        billing_interval TEXT DEFAULT 'monthly',
        max_customers INTEGER DEFAULT 50,
        max_invoices_per_month INTEGER DEFAULT 20,
        max_catalog_items INTEGER DEFAULT 20,
        max_staff_seats INTEGER DEFAULT 1,
        features JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS tagline TEXT;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_ngn NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_usd NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly';
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_customers INTEGER DEFAULT 50;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_invoices_per_month INTEGER DEFAULT 20;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_catalog_items INTEGER DEFAULT 20;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_staff_seats INTEGER DEFAULT 1;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

      -- Seed subscription plans
      INSERT INTO subscription_plans (id, name, tagline, price_ngn, price_usd, billing_interval, max_customers, max_invoices_per_month, max_catalog_items, max_staff_seats, features)
      VALUES 
      ('free', 'Free Starter', 'Perfect for solo operators and new businesses finding their stride', 0, 0, 'monthly', 30, 15, 15, 1, '["Up to 30 Customers", "15 Invoices & Quotes /mo", "Standard Receipt Generation", "Bank Transfer Instructions", "Mobile Responsive Dashboard"]'::jsonb),
      ('starter', 'Growth Starter', 'Ideal for busy local shops, salons, and boutique service providers', 15000, 19, 'monthly', 200, 100, 75, 2, '["Up to 200 Customers", "100 Invoices & Quotes /mo", "Automated Payment Tracking", "Branded PDF Receipts", "2 Staff Accounts", "WhatsApp Shareable Links"]'::jsonb),
      ('growth', 'Business Pro', 'Designed for scaling restaurants, clinics, retail stores & consultancies', 35000, 45, 'monthly', 1000, 999999, 500, 999999, '["Up to 1,000 Customers", "Unlimited Invoices & Quotations", "Real-time Sales Analytics", "Inventory & Stock Tracking", "Unlimited Staff Accounts with Roles", "Custom Domain & Priority Support"]'::jsonb),
      ('pro', 'Enterprise Scale', 'For multi-location businesses, legal practices and commercial chains', 75000, 95, 'monthly', 999999, 999999, 999999, 999999, '["Unlimited Customers", "Unlimited Invoices & Quotations", "Advanced Tax & Audit Logs", "Unlimited Staff Accounts (Multi-Seat RBAC)", "Dedicated Account Manager", "Custom Integrations & API Access"]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        tagline = EXCLUDED.tagline,
        price_ngn = EXCLUDED.price_ngn,
        price_usd = EXCLUDED.price_usd,
        billing_interval = EXCLUDED.billing_interval,
        max_customers = EXCLUDED.max_customers,
        max_invoices_per_month = EXCLUDED.max_invoices_per_month,
        max_catalog_items = EXCLUDED.max_catalog_items,
        max_staff_seats = EXCLUDED.max_staff_seats,
        features = EXCLUDED.features;

      -- 2. Tenants (Businesses)
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT,
        business_name TEXT,
        slug TEXT UNIQUE NOT NULL,
        industry TEXT NOT NULL DEFAULT 'other',
        owner_email TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        country TEXT DEFAULT 'NG',
        currency TEXT DEFAULT 'NGN',
        timezone TEXT DEFAULT 'Africa/Lagos',
        logo_url TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        plan_id TEXT DEFAULT 'free',
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_name TEXT;
      ALTER TABLE tenants ALTER COLUMN business_name DROP NOT NULL;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT 'other';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE tenants ALTER COLUMN email DROP NOT NULL;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'NG';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Lagos';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'free';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_email);
      CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
      CREATE INDEX IF NOT EXISTS idx_tenants_industry ON tenants(industry);

      -- 3. Tenant Settings & Custom Terminology
      CREATE TABLE IF NOT EXISTS tenant_settings (
        tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        customer_label TEXT DEFAULT 'Customer',
        catalog_label TEXT DEFAULT 'Products & Services',
        invoice_prefix TEXT DEFAULT 'INV',
        quotation_prefix TEXT DEFAULT 'QTE',
        tax_rate_percentage NUMERIC DEFAULT 7.5,
        bank_name TEXT,
        bank_account_number TEXT,
        bank_account_name TEXT,
        payment_instructions TEXT,
        whatsapp_notifications BOOLEAN DEFAULT TRUE,
        email_notifications BOOLEAN DEFAULT TRUE,
        receipt_footer_note TEXT DEFAULT 'Thank you for your valued patronage!',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 4. Tenant Members & RBAC
      CREATE TABLE IF NOT EXISTS tenant_members (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        name TEXT,
        phone TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_tenant_member UNIQUE (tenant_id, user_email)
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_members_email ON tenant_members(user_email);
      CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);

      -- 5. Subscriptions
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
        status TEXT DEFAULT 'active',
        current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        current_period_end TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '1 month',
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);

      -- 6. Customers
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company_name TEXT,
        address TEXT,
        notes TEXT,
        total_spent NUMERIC DEFAULT 0,
        outstanding_balance NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

      -- 7. Catalogue Items
      CREATE TABLE IF NOT EXISTS catalog_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT DEFAULT 'service',
        category TEXT DEFAULT 'General',
        unit_price NUMERIC NOT NULL DEFAULT 0,
        cost_price NUMERIC DEFAULT 0,
        sku TEXT,
        stock_quantity INTEGER DEFAULT 0,
        track_inventory BOOLEAN DEFAULT FALSE,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_catalog_tenant ON catalog_items(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_catalog_category ON catalog_items(category);

      -- 8. Quotations
      CREATE TABLE IF NOT EXISTS quotations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        quotation_number TEXT NOT NULL,
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        customer_phone TEXT,
        status TEXT DEFAULT 'DRAFT',
        issue_date DATE DEFAULT CURRENT_DATE,
        expiry_date DATE DEFAULT CURRENT_DATE + INTERVAL '14 days',
        subtotal NUMERIC NOT NULL DEFAULT 0,
        tax_amount NUMERIC NOT NULL DEFAULT 0,
        discount_amount NUMERIC NOT NULL DEFAULT 0,
        total_amount NUMERIC NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_quotations_tenant ON quotations(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);

      -- Quotation Items
      CREATE TABLE IF NOT EXISTS quotation_items (
        id TEXT PRIMARY KEY,
        quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        quantity NUMERIC NOT NULL DEFAULT 1,
        unit_price NUMERIC NOT NULL DEFAULT 0,
        total_price NUMERIC NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_quotation_items_qid ON quotation_items(quotation_id);

      -- 9. Invoices
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        invoice_number TEXT NOT NULL,
        quotation_id TEXT REFERENCES quotations(id) ON DELETE SET NULL,
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        customer_phone TEXT,
        status TEXT DEFAULT 'UNPAID',
        issue_date DATE DEFAULT CURRENT_DATE,
        due_date DATE DEFAULT CURRENT_DATE + INTERVAL '7 days',
        subtotal NUMERIC NOT NULL DEFAULT 0,
        tax_amount NUMERIC NOT NULL DEFAULT 0,
        discount_amount NUMERIC NOT NULL DEFAULT 0,
        total_amount NUMERIC NOT NULL DEFAULT 0,
        amount_paid NUMERIC NOT NULL DEFAULT 0,
        balance_due NUMERIC NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);

      -- Invoice Items
      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        quantity NUMERIC NOT NULL DEFAULT 1,
        unit_price NUMERIC NOT NULL DEFAULT 0,
        total_price NUMERIC NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_invoice_items_iid ON invoice_items(invoice_id);

      -- 10. Payments
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        payment_method TEXT DEFAULT 'BANK_TRANSFER',
        reference TEXT,
        payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_by TEXT,
        receipt_number TEXT UNIQUE
      );
      CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

      -- 11. Tenant Audit Logs
      CREATE TABLE IF NOT EXISTS tenant_audit_logs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_email TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_audit_tenant ON tenant_audit_logs(tenant_id);

      -- Schema Synchronization for pre-existing tables
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS customer_label TEXT DEFAULT 'Customer';
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS catalog_label TEXT DEFAULT 'Products & Services';
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS quotation_prefix TEXT DEFAULT 'QTE';
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS tax_rate_percentage NUMERIC DEFAULT 7.5;
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS bank_name TEXT;
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS payment_instructions TEXT;
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS whatsapp_notifications BOOLEAN DEFAULT TRUE;
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;
      ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS receipt_footer_note TEXT DEFAULT 'Thank you for your valued patronage!';

      ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC DEFAULT 0;

      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE catalog_items ALTER COLUMN name DROP NOT NULL;
      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
      ALTER TABLE catalog_items ALTER COLUMN price DROP NOT NULL;
      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE catalog_items ALTER COLUMN title DROP NOT NULL;
      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0;
      ALTER TABLE catalog_items ALTER COLUMN unit_price DROP NOT NULL;
      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT FALSE;
      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
      UPDATE catalog_items SET title = COALESCE(title, name) WHERE title IS NULL;
      UPDATE catalog_items SET name = COALESCE(name, title) WHERE name IS NULL;
      UPDATE catalog_items SET unit_price = COALESCE(unit_price, price, 0) WHERE unit_price IS NULL OR unit_price = 0;
      UPDATE catalog_items SET price = COALESCE(price, unit_price, 0) WHERE price IS NULL OR price = 0;

      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS item_id TEXT;
      ALTER TABLE invoice_items ALTER COLUMN item_id DROP NOT NULL;
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS catalog_item_id TEXT;
      ALTER TABLE invoice_items ALTER COLUMN catalog_item_id DROP NOT NULL;
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE invoice_items ALTER COLUMN description DROP NOT NULL;
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE invoice_items ALTER COLUMN title DROP NOT NULL;

      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_id TEXT;
      ALTER TABLE quotation_items ALTER COLUMN item_id DROP NOT NULL;
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS catalog_item_id TEXT;
      ALTER TABLE quotation_items ALTER COLUMN catalog_item_id DROP NOT NULL;
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE quotation_items ALTER COLUMN description DROP NOT NULL;
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE quotation_items ALTER COLUMN title DROP NOT NULL;

      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;
      ALTER TABLE invoices ALTER COLUMN customer_name DROP NOT NULL;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_email TEXT;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;

      ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS display_name TEXT;
      UPDATE tenant_members SET name = COALESCE(name, display_name) WHERE name IS NULL;

      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS catalog_item_id TEXT;
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_id TEXT;
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS description TEXT;
      UPDATE quotation_items SET title = COALESCE(title, description) WHERE title IS NULL;

      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS catalog_item_id TEXT;
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS item_id TEXT;
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;
      UPDATE invoice_items SET title = COALESCE(title, description) WHERE title IS NULL;

      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_name TEXT;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_email TEXT;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_phone TEXT;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS expiry_date DATE;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS valid_until DATE;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

      ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS user_email TEXT;
      ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS performed_by_email TEXT;
      ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
      ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS target_entity TEXT;
      ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE tenant_audit_logs ADD COLUMN IF NOT EXISTS target_id TEXT;

      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by_email TEXT;
      ALTER TABLE invoices ALTER COLUMN created_by_email DROP NOT NULL;

      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS created_by_email TEXT;
      ALTER TABLE quotations ALTER COLUMN created_by_email DROP NOT NULL;

      ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference TEXT;
      ALTER TABLE payments ALTER COLUMN reference DROP NOT NULL;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number TEXT;
      ALTER TABLE payments ALTER COLUMN reference_number DROP NOT NULL;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS recorded_by_email TEXT;
      ALTER TABLE payments ALTER COLUMN recorded_by_email DROP NOT NULL;
      ALTER TABLE payments ALTER COLUMN receipt_number DROP NOT NULL;
      UPDATE payments SET reference = COALESCE(reference, reference_number) WHERE reference IS NULL;

      -- Seed Initial Demo Business ("Apex Luxe Salon & Spa")
      INSERT INTO tenants (id, name, business_name, slug, industry, owner_email, phone, email, country, currency, timezone, plan_id, status)
      VALUES 
      ('biz_demo_luxe', 'Apex Luxe Salon & Spa', 'Apex Luxe Salon & Spa', 'apex-luxe', 'salon', 'admin@avartah.com', '+2348012345678', 'contact@apexluxe.ng', 'NG', 'NGN', 'Africa/Lagos', 'growth', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO tenant_settings (tenant_id, customer_label, catalog_label, invoice_prefix, quotation_prefix, tax_rate_percentage, bank_name, bank_account_number, bank_account_name, payment_instructions)
      VALUES 
      ('biz_demo_luxe', 'Client', 'Treatments & Services', 'APX-INV', 'APX-QTE', 7.5, 'Zenith Bank', '1019283746', 'Apex Luxe Beauty Ltd', 'Please use invoice number as transfer reference')
      ON CONFLICT (tenant_id) DO NOTHING;

      INSERT INTO tenant_members (id, tenant_id, user_email, role, name, phone)
      VALUES 
      ('tm_demo_1', 'biz_demo_luxe', 'admin@avartah.com', 'owner', 'Ngozi Okonjo', '+2348012345678')
      ON CONFLICT (tenant_id, user_email) DO NOTHING;

      -- Seed Demo Customers
      INSERT INTO customers (id, tenant_id, name, email, phone, company_name, notes, total_spent, outstanding_balance)
      VALUES
      ('cust_demo_1', 'biz_demo_luxe', 'Amara Kalu', 'amara.k@gmail.com', '+2348031112233', 'Vanguard Media', 'VIP Bridal styling client', 250000, 0),
      ('cust_demo_2', 'biz_demo_luxe', 'Tunde Adeleke', 'tunde@adelekegroup.com', '+2348024445566', 'Adeleke Group', 'Executive grooming membership', 185000, 45000),
      ('cust_demo_3', 'biz_demo_luxe', 'Zainab Bello', 'zbello@horizon.ng', '+2348097778899', 'Horizon Legal', 'Regular weekend facial & hair treatment', 95000, 0)
      ON CONFLICT (id) DO NOTHING;

      -- Seed Demo Catalog Items
      INSERT INTO catalog_items (id, tenant_id, title, description, type, category, unit_price, cost_price, sku, stock_quantity, track_inventory, is_available)
      VALUES
      ('cat_demo_1', 'biz_demo_luxe', 'Signature Hydrafacial', 'Deep cleansing and hydration with organic serum infusion', 'service', 'Facials', 45000, 10000, 'SRV-HYD-01', 0, FALSE, TRUE),
      ('cat_demo_2', 'biz_demo_luxe', 'Executive Precision Haircut & Beard Trim', 'Hot towel cleanse, scalp massage, scissors haircut and beard oil treatment', 'service', 'Hair & Grooming', 20000, 2000, 'SRV-GRM-02', 0, FALSE, TRUE),
      ('cat_demo_3', 'biz_demo_luxe', 'Bridal Glam Hair & Makeup Package', 'Full bridal entourage hairstyle, airbrush makeup and champagne treatment', 'service', 'Packages', 180000, 35000, 'SRV-BRD-03', 0, FALSE, TRUE),
      ('cat_demo_4', 'biz_demo_luxe', 'Argan Oil Nourishing Serum 100ml', 'Pure Moroccan organic argan restorative hair serum', 'product', 'Haircare Products', 18500, 9000, 'PRD-ARG-10', 48, TRUE, TRUE)
      ON CONFLICT (id) DO NOTHING;

      -- Seed Demo Invoices
      INSERT INTO invoices (id, tenant_id, invoice_number, customer_id, customer_name, customer_email, customer_phone, status, issue_date, due_date, subtotal, tax_amount, discount_amount, total_amount, amount_paid, balance_due, notes)
      VALUES
      ('inv_demo_1', 'biz_demo_luxe', 'APX-INV-1001', 'cust_demo_1', 'Amara Kalu', 'amara.k@gmail.com', '+2348031112233', 'PAID', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE - INTERVAL '5 days', 250000, 0, 0, 250000, 250000, 0, 'Paid via Direct Bank Transfer'),
      ('inv_demo_2', 'biz_demo_luxe', 'APX-INV-1002', 'cust_demo_2', 'Tunde Adeleke', 'tunde@adelekegroup.com', '+2348024445566', 'PARTIALLY_PAID', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days', 185000, 0, 0, 185000, 140000, 45000, '50% deposit received, balance on final session')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO invoice_items (id, invoice_id, catalog_item_id, title, quantity, unit_price, total_price)
      VALUES
      ('ii_demo_1', 'inv_demo_1', 'cat_demo_3', 'Bridal Glam Hair & Makeup Package', 1, 180000, 180000),
      ('ii_demo_2', 'inv_demo_1', 'cat_demo_1', 'Signature Hydrafacial', 1, 45000, 45000),
      ('ii_demo_3', 'inv_demo_1', 'cat_demo_4', 'Argan Oil Nourishing Serum 100ml', 1, 25000, 25000),
      ('ii_demo_4', 'inv_demo_2', 'cat_demo_1', 'Signature Hydrafacial', 3, 45000, 135000),
      ('ii_demo_5', 'inv_demo_2', 'cat_demo_2', 'Executive Precision Haircut & Beard Trim', 2, 25000, 50000)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO payments (id, tenant_id, invoice_id, amount, payment_method, reference, receipt_number, notes, created_by)
      VALUES
      ('pay_demo_1', 'biz_demo_luxe', 'inv_demo_1', 250000, 'BANK_TRANSFER', 'ZEN-TRF-994821', 'RCPT-2026-001', 'Settled in full via Zenith Bank', 'admin@avartah.com'),
      ('pay_demo_2', 'biz_demo_luxe', 'inv_demo_2', 140000, 'POS_CARD', 'POS-STAN-5521', 'RCPT-2026-002', 'Card payment at front desk', 'admin@avartah.com')
      ON CONFLICT (id) DO NOTHING;
    `
  },
  {
    id: '023_subscription_plans_schema_fix',
    description: 'Ensure tagline and all required columns exist on subscription_plans table',
    sql: `
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS tagline TEXT;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_ngn NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_usd NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly';
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_customers INTEGER DEFAULT 50;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_invoices_per_month INTEGER DEFAULT 20;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_catalog_items INTEGER DEFAULT 20;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_staff_seats INTEGER DEFAULT 1;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

      INSERT INTO subscription_plans (id, name, tagline, price_ngn, price_usd, billing_interval, max_customers, max_invoices_per_month, max_catalog_items, max_staff_seats, features)
      VALUES 
      ('free', 'Free Starter', 'Perfect for solo operators and new businesses finding their stride', 0, 0, 'monthly', 30, 15, 15, 1, '["Up to 30 Customers", "15 Invoices & Quotes /mo", "Standard Receipt Generation", "Bank Transfer Instructions", "Mobile Responsive Dashboard"]'::jsonb),
      ('starter', 'Growth Starter', 'Ideal for busy local shops, salons, and boutique service providers', 15000, 19, 'monthly', 200, 100, 75, 2, '["Up to 200 Customers", "100 Invoices & Quotes /mo", "Automated Payment Tracking", "Branded PDF Receipts", "2 Staff Accounts", "WhatsApp Shareable Links"]'::jsonb),
      ('growth', 'Business Pro', 'Designed for scaling restaurants, clinics, retail stores & consultancies', 35000, 45, 'monthly', 1000, 999999, 500, 999999, '["Up to 1,000 Customers", "Unlimited Invoices & Quotations", "Real-time Sales Analytics", "Inventory & Stock Tracking", "Unlimited Staff Accounts with Roles", "Custom Domain & Priority Support"]'::jsonb),
      ('pro', 'Enterprise Scale', 'For multi-location businesses, legal practices and commercial chains', 75000, 95, 'monthly', 999999, 999999, 999999, 999999, '["Unlimited Customers", "Unlimited Invoices & Quotations", "Advanced Tax & Audit Logs", "Unlimited Staff Accounts (Multi-Seat RBAC)", "Dedicated Account Manager", "Custom Integrations & API Access"]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        tagline = EXCLUDED.tagline,
        price_ngn = EXCLUDED.price_ngn,
        price_usd = EXCLUDED.price_usd,
        billing_interval = EXCLUDED.billing_interval,
        max_customers = EXCLUDED.max_customers,
        max_invoices_per_month = EXCLUDED.max_invoices_per_month,
        max_catalog_items = EXCLUDED.max_catalog_items,
        max_staff_seats = EXCLUDED.max_staff_seats,
        features = EXCLUDED.features;
    `
  },
  {
    id: '024_tenants_and_saas_schema_repair',
    description: 'Ensure tenants table exists and has all required columns',
    sql: `
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT,
        business_name TEXT,
        slug TEXT UNIQUE NOT NULL,
        industry TEXT NOT NULL DEFAULT 'other',
        owner_email TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        country TEXT DEFAULT 'NG',
        currency TEXT DEFAULT 'NGN',
        timezone TEXT DEFAULT 'Africa/Lagos',
        logo_url TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        plan_id TEXT DEFAULT 'free',
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_name TEXT;
      ALTER TABLE tenants ALTER COLUMN business_name DROP NOT NULL;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT 'other';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'NG';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Lagos';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'free';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      UPDATE tenants SET business_name = name WHERE business_name IS NULL AND name IS NOT NULL;
      UPDATE tenants SET name = business_name WHERE name IS NULL AND business_name IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_email);
      CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
      CREATE INDEX IF NOT EXISTS idx_tenants_industry ON tenants(industry);

      INSERT INTO tenants (id, name, business_name, slug, industry, owner_email, phone, email, country, currency, timezone, plan_id, status)
      VALUES 
      ('biz_demo_luxe', 'Apex Luxe Salon & Spa', 'Apex Luxe Salon & Spa', 'apex-luxe', 'salon', 'admin@avartah.com', '+2348012345678', 'contact@apexluxe.ng', 'NG', 'NGN', 'Africa/Lagos', 'growth', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        business_name = EXCLUDED.business_name,
        slug = EXCLUDED.slug,
        industry = EXCLUDED.industry,
        owner_email = EXCLUDED.owner_email,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        country = EXCLUDED.country,
        currency = EXCLUDED.currency,
        timezone = EXCLUDED.timezone,
        plan_id = EXCLUDED.plan_id,
        status = EXCLUDED.status;
    `
  },
  {
    id: '025_tenants_business_name_constraint_fix',
    description: 'Drop NOT NULL constraint on business_name and sync name and business_name in tenants',
    sql: `
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_name TEXT;
      ALTER TABLE tenants ALTER COLUMN business_name DROP NOT NULL;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS name TEXT;
      UPDATE tenants SET business_name = name WHERE business_name IS NULL AND name IS NOT NULL;
      UPDATE tenants SET name = business_name WHERE name IS NULL AND business_name IS NOT NULL;
    `
  },
  {
    id: '026_business_os_production_hardening',
    description: 'Create performance and tenant isolation indexes for Business OS tables',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_email ON tenant_members(tenant_id, user_email);
      CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created ON invoices(tenant_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_catalog_items_tenant ON catalog_items(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(tenant_id, reference);
      CREATE INDEX IF NOT EXISTS idx_quotations_tenant_created ON quotations(tenant_id, created_at);
    `
  },
  {
    id: '027_unlimited_staff_seats_pro_plans',
    description: 'Update Business Pro (growth) and Enterprise Scale (pro) subscription plans to unlimited staff seats',
    sql: `
      UPDATE subscription_plans
      SET max_staff_seats = 999999,
          features = '["Up to 1,000 Customers", "Unlimited Invoices & Quotations", "Real-time Sales Analytics", "Inventory & Stock Tracking", "Unlimited Staff Accounts with Roles", "Custom Domain & Priority Support"]'::jsonb
      WHERE id = 'growth';

      UPDATE subscription_plans
      SET max_staff_seats = 999999,
          features = '["Unlimited Customers", "Unlimited Invoices & Quotations", "Advanced Tax & Audit Logs", "Unlimited Staff Accounts (Multi-Seat RBAC)", "Dedicated Account Manager", "Custom Integrations & API Access"]'::jsonb
      WHERE id = 'pro';
    `
  },
  {
    id: '028_paystack_payments_and_webhook_idempotency',
    description: 'Add Paystack subscription payment tracking, unique constraints, and webhook idempotency logs',
    sql: `
      -- 1. Webhook events table for cryptographic replay prevention and deduplication
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'paystack',
        event_key TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        payload JSONB,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'PROCESSED'
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_events_key ON webhook_events(event_key);

      -- 2. Ensure payments table has Paystack-compatible tracking columns
      ALTER TABLE payments ALTER COLUMN invoice_id DROP NOT NULL;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SUCCESS';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id INTEGER;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_email TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES subscription_plans(id);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'bank_transfer';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_kobo BIGINT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS channel TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_reference ON payments(provider_reference) WHERE provider_reference IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON payments(tenant_id, status);

      -- 3. Ensure subscriptions table supports Paystack reference and prevent duplicate activation
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_reference TEXT;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paystack';
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_email TEXT;

      DROP INDEX IF EXISTS uq_subscriptions_payment_ref;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_payment_ref ON subscriptions(payment_reference);

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_subscriptions_payment_ref_const')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_subscriptions_payment_ref_const') THEN
          BEGIN
            ALTER TABLE subscriptions ADD CONSTRAINT uq_subscriptions_payment_ref_const UNIQUE (payment_reference);
          EXCEPTION
            WHEN OTHERS THEN NULL;
          END;
        END IF;
      END $$;

      -- 4. Session security: ensure admin_sessions has token_hash
      ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
    `
  },
  {
    id: '029_subscriptions_unique_payment_reference_constraint',
    description: 'Ensure unique constraint exists on subscriptions(payment_reference) for idempotent conflict resolution',
    sql: `
      DROP INDEX IF EXISTS uq_subscriptions_payment_ref;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_payment_ref ON subscriptions(payment_reference);

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_subscriptions_payment_ref_const')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_subscriptions_payment_ref_const') THEN
          BEGIN
            ALTER TABLE subscriptions ADD CONSTRAINT uq_subscriptions_payment_ref_const UNIQUE (payment_reference);
          EXCEPTION
            WHEN OTHERS THEN NULL;
          END;
        END IF;
      END $$;
    `
  },
  {
    id: '030_blogs_columns_sync',
    description: 'Ensure blogs table has author, category, cover_image, excerpt, published, published_at, created_at, updated_at columns',
    sql: `
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS author TEXT;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Engineering';
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS cover_image TEXT;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS excerpt TEXT;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT TRUE;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE blogs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `
  },
  {
    id: '031_search_jobs_table_and_indexes',
    description: 'Create search_jobs table for persistent search job summaries and duplicate detection indexes',
    sql: `
      CREATE TABLE IF NOT EXISTS search_jobs (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'READY',
        cursor_position JSONB DEFAULT '{}'::jsonb,
        start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completion_time TIMESTAMP WITH TIME ZONE,
        candidates_processed INTEGER DEFAULT 0,
        qualified_prospects_found INTEGER DEFAULT 0,
        duplicates_skipped INTEGER DEFAULT 0,
        candidates_rejected INTEGER DEFAULT 0,
        provider_failure_counts JSONB DEFAULT '{}'::jsonb,
        config JSONB DEFAULT '{}'::jsonb,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_search_jobs_status ON search_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_search_jobs_created ON search_jobs(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_prospects_business_loc_canonical ON prospects (LOWER(business_name), LOWER(location));
      CREATE INDEX IF NOT EXISTS idx_prospects_phone_norm ON prospects (phone) WHERE phone IS NOT NULL AND phone != '';
      CREATE INDEX IF NOT EXISTS idx_prospects_email_norm ON prospects (LOWER(email)) WHERE email IS NOT NULL AND email != '';
      CREATE INDEX IF NOT EXISTS idx_prospects_website_norm ON prospects (LOWER(website_url)) WHERE website_url IS NOT NULL AND website_url != '';
    `
  },
  {
    id: '032_crm_outreach_delivery_status',
    description: 'Extend crm_outreach_history with delivery status tracking, provider telemetry, AI-pitch metadata, and crm_lead_id linkage',
    sql: `
      ALTER TABLE crm_outreach_history ALTER COLUMN prospect_id DROP NOT NULL;
      ALTER TABLE crm_outreach_history ADD COLUMN IF NOT EXISTS crm_lead_id TEXT;
      ALTER TABLE crm_outreach_history ADD COLUMN IF NOT EXISTS business_name TEXT;
      ALTER TABLE crm_outreach_history ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'DRAFT_OPENED';
      ALTER TABLE crm_outreach_history ADD COLUMN IF NOT EXISTS provider TEXT;
      ALTER TABLE crm_outreach_history ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
      ALTER TABLE crm_outreach_history ADD COLUMN IF NOT EXISTS error_message TEXT;
      ALTER TABLE crm_outreach_history ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE crm_outreach_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE INDEX IF NOT EXISTS idx_crm_outreach_lead_id ON crm_outreach_history(crm_lead_id);
      CREATE INDEX IF NOT EXISTS idx_crm_outreach_delivery_status ON crm_outreach_history(delivery_status);
      CREATE INDEX IF NOT EXISTS idx_crm_outreach_dispatched_desc ON crm_outreach_history(dispatched_at DESC);

      UPDATE crm_outreach_history h
      SET crm_lead_id = COALESCE(h.crm_lead_id, p.crm_lead_id),
          business_name = COALESCE(NULLIF(h.business_name, ''), p.business_name),
          provider = COALESCE(
            NULLIF(h.provider, ''),
            CASE WHEN LOWER(h.channel) = 'whatsapp' THEN 'whatsapp_web' ELSE 'mailto' END
          )
      FROM prospects p
      WHERE h.prospect_id = p.id
        AND (h.crm_lead_id IS NULL OR h.business_name IS NULL OR h.provider IS NULL);
    `
  }
];

// Distributed migration lock ID for PostgreSQL advisory lock
const MIGRATION_LOCK_ID = 849204910284;

/**
 * Execute versioned database migrations with distributed advisory locking.
 * Safe against simultaneous execution by multiple Vercel serverless cold starts.
 * Never silently swallows migration errors.
 */
export async function runDatabaseMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn('[Database Migration Notice]: DATABASE_URL is not configured. Skipping migrations in local/unconfigured environment.');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Acquire PostgreSQL transaction-level advisory lock
    // Prevents concurrent execution of migrations across simultaneous Vercel instances
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);

    // Ensure schema migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        description TEXT,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Fetch applied migrations
    const appliedRes = await client.query('SELECT id FROM schema_migrations');
    const appliedIds = new Set(appliedRes.rows.map(r => r.id));

    // Execute any pending migrations sequentially
    for (const migration of MIGRATIONS) {
      if (!appliedIds.has(migration.id)) {
        console.log(`[Database Migration] Applying migration: ${migration.id} (${migration.description})`);
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (id, description, applied_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
          [migration.id, migration.description]
        );
        console.log(`[Database Migration] Successfully applied: ${migration.id}`);
      }
    }

    await client.query('COMMIT');
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('[FATAL Database Migration Error]:', err.message || err);
    throw err;
  } finally {
    client.release();
  }
}
