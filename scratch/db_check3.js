const url = 'https://maxjfweqbzdpcszvrrsc.supabase.co';
const key = 'sb_publishable_t29BkzUpkJ19lOc62MvACg_w2i5KFem';
const branchId = '67fa6870-880b-4f21-bbd8-4e279eeda805';

async function check() {
  const res = await fetch(`${url}/rest/v1/ingredients?branch_id=eq.${branchId}&select=id,name`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  
  const ingredients = await res.json();
  
  const counts = {};
  ingredients.forEach(p => counts[p.name] = (counts[p.name] || 0) + 1);
  
  console.log("=== DUPLICATE INGREDIENTS ===");
  for (const [name, c] of Object.entries(counts)) {
    if (c > 1) console.log(`${name}: ${c}`);
  }
}

check();
