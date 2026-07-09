import { createClient } from "@supabase/supabase-js";

// Set these in a .env file at the frontend root:
//   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
// The publishable key is safe to expose in frontend code — it's designed for that.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
