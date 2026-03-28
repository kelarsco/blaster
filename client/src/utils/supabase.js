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

// Create singleton instance
export const supabase = createClient(supabaseUrl, supabaseKey);
