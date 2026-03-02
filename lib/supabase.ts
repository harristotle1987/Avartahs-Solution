
import { createClient } from '@supabase/supabase-js';

/**
 * Super Base Connection Node
 * Strictly utilizes environment variables for backend synchronization.
 */
export const supabaseUrl = process.env.SUPABASE_URL || '';
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Backend Status Check
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
  supabaseUrl.startsWith('http');

// Safe Initialization Protocol
// Prevents client-side crashes while maintaining a reference for the API bridge.
const safeUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder';

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
