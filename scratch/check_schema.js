import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log("Checking global_settings table schema...");
  
  // Just try to fetch the new columns to see if they exist
  const { data, error } = await supabase
    .from('global_settings')
    .select('peak_hour_start, peak_hour_end, peak_hour_multiplier')
    .limit(1);
    
  if (error) {
    console.error("❌ Schema mismatch detected!");
    console.error(error.message);
  } else {
    console.log("✅ Database schema is up to date. Columns exist.");
    console.log("Sample data:", data);
  }
}

checkDatabase();
