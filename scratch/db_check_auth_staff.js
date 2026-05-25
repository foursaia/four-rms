
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, serviceKey);

async function check() {
  const { data: staff } = await supabase.from('staff').select('*');
  console.log("Staff records:", staff?.length);
  staff?.forEach(s => console.log(` - ${s.full_name}: Auth ID ${s.auth_user_id}`));

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) console.error("Error listing users:", error);
  console.log("\nAuth users:", users?.length);
  users?.forEach(u => console.log(` - ${u.email}: ${u.id}`));
}

check();
