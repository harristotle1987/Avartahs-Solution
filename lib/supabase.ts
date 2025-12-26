import { createClient } from '@supabase/supabase-js';

// Credentials are now strictly fetched from environment variables.
// In development, ensure your .env file is populated.
// In Vercel, add these to the Project Environment Variables.
export const supabaseUrl = process.env.SUPABASE_URL || '';
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Logic to prevent the app from crashing if variables are missing
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Initialization
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);