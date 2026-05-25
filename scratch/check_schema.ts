// @ts-check
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log("Checking global_settings table schema...");
  
  const { data, error } = await supabase
    .from('global_settings')
    .select('peak_hour_start, peak_hour_end, peak_hour_multiplier')
    .limit(1);
    
  if (error) {
    console.error("❌ Schema mismatch detected in global_settings!");
    console.error(error.message);
  } else {
    console.log("✅ Database schema is up to date for global_settings.");
  }

  console.log("Checking brands table schema...");
  const { data: brandData, error: brandError } = await supabase
    .from('brands')
    .select('default_discount')
    .limit(1);
    
  if (brandError) {
    console.error("❌ Schema mismatch detected in brands!");
    console.error(brandError.message);
  } else {
    console.log("✅ Database schema is up to date for brands.");
  }
}

checkDatabase();
