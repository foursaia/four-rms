import fs from 'fs';
import path from 'path';

// Parse .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function checkTable(table, columns) {
  console.log(`Checking ${table} table for columns: ${columns}...`);
  const url = `${supabaseUrl}/rest/v1/${table}?select=${columns}&limit=1`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error(`❌ Schema mismatch detected in ${table}!`);
    console.error(data);
  } else {
    console.log(`✅ Database schema is up to date for ${table}.`);
    console.log(`Sample data:`, data);
  }
}

async function run() {
  await checkTable('global_settings', 'peak_hour_start,peak_hour_end,peak_hour_multiplier');
  await checkTable('brands', 'default_discount');
}

run();
