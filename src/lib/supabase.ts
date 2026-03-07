'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * Centrally manages the Supabase client for media synchronization.
 * Uses the exact project URL and publishable key provided for the 'Images' bucket.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://owfjowiiyshhqzhatwqr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_9RMHLJbKcpjnvH5SuUx7hg_3TuajLPe';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

if (!supabase) {
    console.error("Critical: Supabase client failed initialization.");
}
