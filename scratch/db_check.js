const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const branchId = '67fa6870-880b-4f21-bbd8-4e279eeda805';

async function checkDb() {
  console.log("Checking DB state...");
  
  // 1. Check duplicate products
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('branch_id', branchId);
    
  console.log(`\nTotal Products: ${products?.length}`);
  
  const productCounts = {};
  products?.forEach(p => {
    productCounts[p.name] = (productCounts[p.name] || 0) + 1;
  });
  
  console.log("Duplicate Products:");
  for (const [name, count] of Object.entries(productCounts)) {
    if (count > 1) console.log(`- ${name}: ${count} times`);
  }

  // 2. Check duplicate ingredients
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name')
    .eq('branch_id', branchId);
    
  console.log(`\nTotal Ingredients: ${ingredients?.length}`);
  
  const ingCounts = {};
  ingredients?.forEach(i => {
    ingCounts[i.name] = (ingCounts[i.name] || 0) + 1;
  });
  
  console.log("Duplicate Ingredients:");
  let hasDupIng = false;
  for (const [name, count] of Object.entries(ingCounts)) {
    if (count > 1) {
      console.log(`- ${name}: ${count} times`);
      hasDupIng = true;
    }
  }
  if (!hasDupIng) console.log("None");

  // 3. List actual product names to see why some didn't match
  console.log("\nActual Product Names in DB (first 20):");
  products?.slice(0, 20).forEach(p => console.log(`- "${p.name}"`));
}

checkDb();
