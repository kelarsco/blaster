import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables:', {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING',
    VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ? 'SET' : 'MISSING'
  });
  throw new Error('Supabase environment variables are missing. Please check your .env file.');
}

// Global singleton instance
let supabaseInstance = null;

// Create singleton immediately
export const supabase = (() => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  console.log('🔧 Initializing Supabase singleton client...');
  
  supabaseInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flow: 'pkce' // Use PKCE flow to avoid lock conflicts
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    global: {
      headers: {
        'X-Client-Info': 'wiblaster-client'
      }
    }
  });

  console.log('✅ Supabase singleton client initialized successfully');
  return supabaseInstance;
})();

// Export a function to get the client safely (for async operations)
export async function getSupabaseClient() {
  return supabase;
}
