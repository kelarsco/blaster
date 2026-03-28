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
let isInitializing = false;
let initializationPromise = null;

export const supabase = (() => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (isInitializing) {
    throw new Error('Supabase client is being initialized. Please wait for initialization to complete.');
  }

  isInitializing = true;
  initializationPromise = (async () => {
    try {
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
    } catch (error) {
      console.error('❌ Failed to initialize Supabase client:', error);
      isInitializing = false;
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  throw initializationPromise;
})();

// Export a function to get the client safely
export async function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  if (initializationPromise) {
    await initializationPromise;
    return supabaseInstance;
  }
  
  // If no initialization in progress, return the singleton (which will throw if not ready)
  return supabase;
}
