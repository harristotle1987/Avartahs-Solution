-- AVARTAH SOLUTIONS: CLIENT PROJECT DELIVERY HUB SCHEMA (STEP 7)
-- Authoritative PostgreSQL Schema in Neon

-- 1. Client Projects Table
CREATE TABLE IF NOT EXISTS client_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  description TEXT,
  scope TEXT,
  status TEXT NOT NULL DEFAULT 'Planning',
  start_date DATE,
  target_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  assigned_admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_admin_name TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_projects_client_user ON client_projects(client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_client_email ON client_projects(LOWER(client_email));
CREATE INDEX IF NOT EXISTS idx_client_projects_status ON client_projects(status);
CREATE INDEX IF NOT EXISTS idx_client_projects_archived ON client_projects(is_archived);
CREATE INDEX IF NOT EXISTS idx_client_projects_created ON client_projects(created_at DESC);

-- 2. Project Milestones Table
CREATE TABLE IF NOT EXISTS project_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Not Started',
  notes TEXT,
  client_notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_proj_order ON project_milestones(project_id, order_index ASC);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON project_milestones(status);

-- 3. Project Deliverables Table
CREATE TABLE IF NOT EXISTS project_deliverables (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  milestone_id TEXT REFERENCES project_milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'Document',
  resource_url TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'client_visible',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_deliverables_proj ON project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_project_deliverables_visibility ON project_deliverables(visibility);

-- 4. Project Activities & Timeline Table
CREATE TABLE IF NOT EXISTS project_activities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general_update',
  message TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'client_visible',
  author_email TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'admin',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_activities_proj ON project_activities(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activities_vis ON project_activities(visibility);
