
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function check() {
  const { data: branches } = await supabase.from('branches').select('id, name').limit(1);
  if (!branches || !branches.length) {
    console.log("No branches found");
    return;
  }
  const branchId = branches[0].id;
  console.log(`Checking data for branch: ${branches[0].name} (${branchId})`);

  const { data: cats } = await supabase.from('categories').select('id, name').eq('branch_id', branchId);
  console.log(`Categories found: ${cats?.length || 0}`);
  cats?.forEach(c => console.log(` - ${c.name} (${c.id})`));

  const { data: prods } = await supabase.from('products').select('id, name').eq('branch_id', branchId);
  console.log(`Products found: ${prods?.length || 0}`);
  prods?.forEach(p => console.log(` - ${p.name} (${p.id})`));
}

check();
