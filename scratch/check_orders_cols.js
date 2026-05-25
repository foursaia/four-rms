const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log("Checking columns of 'orders' table...");
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) {
    console.error("Error fetching order:", error.message);
  } else if (data && data.length > 0) {
    console.log("Order columns:", Object.keys(data[0]));
  } else {
    // If table is empty, try to insert dummy or check schema.
    // Let's run a RPC query if possible.
    const { data: cols, error: err } = await supabase.rpc('execute_sql', { query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders';" });
    if (err) {
      console.log("Could not fetch column names via RPC:", err.message);
    } else {
      console.log("Columns:", cols.map(c => c.column_name));
    }
  }
}

checkColumns();
