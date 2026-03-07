'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * Centrally manages the Supabase client for media synchronization.
 * Uses the precise project URL and publishable key provided for this workstation.
 */
const supabaseUrl = 'https://owfjowiiyshhqzhatwqr.supabase.co';
const supabaseAnonKey = 'sb_publishable_9RMHLJbKcpjnvH5SuUx7hg_3TuajLPe';

// Defensive initialization to ensure the client is available globally
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

if (!supabase) {
    console.error("Critical: Supabase client failed initialization. Binary media sync will be unavailable.");
}
