
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, serviceKey);

async function cleanup() {
  const { data: ings } = await supabase.from('ingredients').select('*');
  if (!ings) return;

  const groups = {};
  ings.forEach(i => {
    if (!groups[i.name]) groups[i.name] = [];
    groups[i.name].push(i);
  });

  for (const name in groups) {
    const list = groups[name];
    if (list.length > 1) {
      const master = list[0];
      const others = list.slice(1);
      const otherIds = others.map(o => o.id);

      console.log(`Merging ${name}: keeping ${master.id}, removing ${otherIds.join(', ')}`);

      for (const oldId of otherIds) {
        // 1. Find product_ingredients using this oldId
        const { data: mappings } = await supabase.from('product_ingredients').select('*').eq('ingredient_id', oldId);
        
        if (mappings && mappings.length > 0) {
          for (const map of mappings) {
            // Check if master already exists for this product
            const { data: existing } = await supabase
              .from('product_ingredients')
              .select('*')
              .eq('product_id', map.product_id)
              .eq('ingredient_id', master.id)
              .single();

            if (existing) {
              // Delete the old mapping
              await supabase.from('product_ingredients').delete().eq('product_id', map.product_id).eq('ingredient_id', oldId);
            } else {
              // Update the old mapping to master
              await supabase.from('product_ingredients').update({ ingredient_id: master.id }).eq('product_id', map.product_id).eq('ingredient_id', oldId);
            }
          }
        }

        // 2. Delete the duplicate ingredient
        await supabase.from('ingredients').delete().eq('id', oldId);
      }
    }
  }
  console.log("Cleanup complete!");
}

cleanup();
