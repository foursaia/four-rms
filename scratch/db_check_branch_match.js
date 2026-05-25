
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function check() {
  const { data: prods } = await supabase.from('products').select('name, branch_id').limit(1);
  console.log("Sample product branch ID:", prods?.[0]?.branch_id);
  
  const { data: branches } = await supabase.from('branches').select('id, name');
  console.log("Available branches:", branches?.map(b => `${b.name} (${b.id})`).join(', '));
}

check();
