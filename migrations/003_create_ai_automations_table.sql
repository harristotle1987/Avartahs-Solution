-- AVARTAH SOLUTIONS: STEP 8 AI AUTOMATION & USAGE METADATA SCHEMA
-- Authoritative PostgreSQL Schema in Neon

CREATE TABLE IF NOT EXISTS ai_automation_logs (
  id TEXT PRIMARY KEY,
  automation_type TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  model_used TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  input_summary TEXT,
  output_summary TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  error_message TEXT,
  tokens_used INTEGER DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_automation_logs_type ON ai_automation_logs(automation_type);
CREATE INDEX IF NOT EXISTS idx_ai_automation_logs_user ON ai_automation_logs(LOWER(user_email));
CREATE INDEX IF NOT EXISTS idx_ai_automation_logs_created ON ai_automation_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_quotas (
  user_email TEXT PRIMARY KEY,
  requests_today INTEGER DEFAULT 0,
  last_request_date DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
