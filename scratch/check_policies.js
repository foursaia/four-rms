const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  console.log("Checking RLS policies for order_items...");
  
  // We can query pg_policies using execute_sql or another method if we use Postgres, 
  // but let's test if there is a REST endpoint or RPC.
  // Wait, let's try to query pg_policies using an RPC named "execute_sql"
  const { data, error } = await supabase.rpc('execute_sql', { query: "SELECT * FROM pg_policies WHERE tablename = 'order_items';" });
  if (error) {
    console.log("RPC execute_sql failed:", error.message);
  } else {
    console.log("Policies:", data);
  }
}

checkPolicies();
