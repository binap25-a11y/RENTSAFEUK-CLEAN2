import { createClient } from '@supabase/supabase-js'

/**
 * Centrally manages the Supabase client.
 * Uses environment variables with robust fallbacks.
 * Note: Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is a valid JWT from your Supabase Dashboard.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only initialize if the key is present to prevent runtime crashes.
// The upload helper (src/lib/upload-image.ts) handles the missing client error gracefully.
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseAnonKey.length > 0) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;
