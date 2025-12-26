import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials for Avartah Solutions live instance
export const supabaseUrl = 'https://wyvgrmedubzooqmrorxb.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5dmdybWVkdWJ6b29xbXJvcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NDM0ODcsImV4cCI6MjA4MjMxOTQ4N30.6Uyxvh04Izzdz2-xo4cqQuX-9mxK5tuFmrDAiZ4ZJgU';

// Configuration check
export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
