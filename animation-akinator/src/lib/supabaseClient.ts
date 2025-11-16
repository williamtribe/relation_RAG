import { createClient } from "@supabase/supabase-js";

console.log(
  "[env check]",
  import.meta.env?.VITE_SUPABASE_URL,
  !!import.meta.env?.VITE_SUPABASE_ANON_KEY
);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseCredentials = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseCredentials
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      }
    })
  : null;
