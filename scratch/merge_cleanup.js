
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://maxjfweqbzdpcszvrrsc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1heGpmd2VxYnpkcGNzenZycnNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0MzYwNiwiZXhwIjoyMDkyNDE5NjA2fQ.NtlIDeJTj6vZgbDzFNDQEjbOJpSaHGmzGtUnKjpRM7w'
);

async function mergeItems(masterName, badNames) {
  console.log(`Merging into ${masterName}...`);
  const { data: ingredients } = await supabase.from('ingredients').select('id, name');
  const master = ingredients.find(i => i.name === masterName);
  if (!master) {
    console.error(`Master ${masterName} not found`);
    return;
  }
  const badItems = ingredients.filter(i => badNames.includes(i.name));
  for (const item of badItems) {
    console.log(`Merging ${item.name} -> ${masterName}`);
    await supabase.from('product_ingredients').update({ ingredient_id: master.id }).eq('ingredient_id', item.id);
    await supabase.from('ingredients').delete().eq('id', item.id);
  }
}

async function run() {
  await mergeItems('Onion', ['Fresh Onions']);
  await mergeItems('Tomato', ['Sliced Tomatoes']);
  console.log("Cleanup finished.");
}
run();
