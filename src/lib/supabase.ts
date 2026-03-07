import { createClient } from '@supabase/supabase-js'

/**
 * Centrally manages the Supabase client.
 * Uses environment variables with robust fallbacks.
 * Initialized conditionally to prevent runtime crashes if keys are missing.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Defensive initialization to prevent crashes on startup.
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;
