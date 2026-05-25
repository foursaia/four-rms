const { Client } = require('pg');
const connectionString = 'postgresql://postgres:saadareebiqraaroob4@[2406:da12:b78:de18:ba1d:8167:d07d:3706]:5432/postgres';

async function checkTables() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables in database:', res.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('Check failed:', err);
  } finally {
    await client.end();
  }
}
checkTables();
