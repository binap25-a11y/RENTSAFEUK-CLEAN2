import { createClient } from '@supabase/supabase-js'

/**
 * Centrally manages the Supabase client.
 * Uses environment variables with robust fallbacks to ensure connection stability.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_9RMHLJbKcpjnvH5SuUx7hg_3TuajLPenPslc8xs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
