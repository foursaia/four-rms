const url = 'https://maxjfweqbzdpcszvrrsc.supabase.co';
const key = 'sb_publishable_t29BkzUpkJ19lOc62MvACg_w2i5KFem';
const branchId = '67fa6870-880b-4f21-bbd8-4e279eeda805';

async function check() {
  const res = await fetch(`${url}/rest/v1/products?branch_id=eq.${branchId}&select=id,name,product_ingredients(ingredient_id,role,price_adjustment,ingredient:ingredients(name))`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  
  const products = await res.json();
  
  for (const p of products) {
    if (!p.name.includes('Pizza') && !p.name.includes('Crust')) continue;
    
    const addons = p.product_ingredients.filter(pi => pi.role === 'addon');
    if (addons.length > 0) {
      console.log(`\nProduct: ${p.name} (ID: ${p.id})`);
      addons.forEach(a => {
        console.log(`  - Addon: ${a.ingredient.name} | Price: ${a.price_adjustment}`);
      });
    } else {
      console.log(`\nProduct: ${p.name} (ID: ${p.id}) - NO ADDONS`);
    }
  }
}

check();
