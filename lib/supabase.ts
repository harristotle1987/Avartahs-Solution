
import { createClient } from '@supabase/supabase-js';

// Credentials fetched from environment variables.
export const supabaseUrl = process.env.SUPABASE_URL || '';
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Logic to check if Supabase is actually configured
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey && supabaseUrl.startsWith('http');

// Safe Initialization: Use a dummy URL if keys are missing to prevent library crashes
const safeUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder';

export const supabase = createClient(safeUrl, safeKey);
