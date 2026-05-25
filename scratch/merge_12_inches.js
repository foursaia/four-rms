
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://maxjfweqbzdpcszvrrsc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1heGpmd2VxYnpkcGNzenZycnNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0MzYwNiwiZXhwIjoyMDkyNDE5NjA2fQ.NtlIDeJTj6vZgbDzFNDQEjbOJpSaHGmzGtUnKjpRM7w'
);

async function mergeIngredients() {
  console.log("Starting ingredient merge...");

  // 1. Find the ingredients
  const { data: ingredients, error: fetchError } = await supabase
    .from('ingredients')
    .select('id, name');

  if (fetchError) {
    console.error("Error fetching ingredients:", fetchError);
    return;
  }

  // Filter for the specific items we saw in the screenshot
  const master = ingredients.find(i => i.name === '12 Inches');
  const badNames = ['12 Inch Upgrade', '12 Inches Upgrade', 'Large Upgrade (+1200)'];
  const badItems = ingredients.filter(i => badNames.includes(i.name));

  if (!master) {
    console.error("Could not find master ingredient '12 Inches'");
    // If not found, let's try to find '12 Inches Upgrade' as fallback
    return;
  }

  console.log(`Master: ${master.name} (${master.id})`);
  
  for (const item of badItems) {
    console.log(`Merging ${item.name} (${item.id}) -> ${master.name}`);

    // Update product_ingredients
    const { error: updateError } = await supabase
      .from('product_ingredients')
      .update({ ingredient_id: master.id })
      .eq('ingredient_id', item.id);

    if (updateError) {
      console.error(`Error updating product_ingredients for ${item.name}:`, updateError);
    }

    // Delete the bad ingredient
    const { error: deleteError } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', item.id);

    if (deleteError) {
       console.warn(`Could not delete ${item.name}:`, deleteError.message);
    } else {
       console.log(`Successfully merged and deleted ${item.name}`);
    }
  }

  console.log("Merge complete.");
}

mergeIngredients();
