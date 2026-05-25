
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function check() {
  const branchId = '67fa6870-880b-4f21-bbd8-4e279eeda805';
  const { data: ings } = await supabase.from('ingredients').select('*').eq('branch_id', branchId);
  
  const counts = {};
  ings.forEach(i => {
    counts[i.name] = (counts[i.name] || 0) + 1;
  });

  console.log("=== INGREDIENTS WITH MULTIPLE ENTRIES ===");
  Object.entries(counts).filter(([name, count]) => count > 1).forEach(([name, count]) => {
    console.log(` - ${name}: ${count} entries`);
  });
}

check();
