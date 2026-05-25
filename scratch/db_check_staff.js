
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function check() {
  const { data: staff } = await supabase.from('staff').select('full_name, branch_id, auth_user_id');
  console.log("=== STAFF ===");
  staff?.forEach(s => console.log(` - ${s.full_name}: Branch ${s.branch_id} (Auth: ${s.auth_user_id})`));

  const { data: branches } = await supabase.from('branches').select('id, name');
  console.log("\n=== BRANCHES ===");
  branches?.forEach(b => console.log(` - ${b.name}: ${b.id}`));
}

check();
