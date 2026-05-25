
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function check() {
  const branchId = '67fa6870-880b-4f21-bbd8-4e279eeda805';
  const { data: cats } = await supabase.from('categories').select('*').eq('branch_id', branchId);
  console.log(`Categories for ${branchId}:`, cats?.length);
  cats?.forEach(c => console.log(` - ${c.name}`));

  const { data: prods } = await supabase.from('products').select('*').eq('branch_id', branchId);
  console.log(`Products for ${branchId}:`, prods?.length);
}

check();
