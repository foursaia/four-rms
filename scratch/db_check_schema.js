const url = 'https://maxjfweqbzdpcszvrrsc.supabase.co';
const key = 'sb_publishable_t29BkzUpkJ19lOc62MvACg_w2i5KFem';

async function check() {
  const res = await fetch(`${url}/rest/v1/product_ingredients?limit=1`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await res.json();
  console.log(data);
}
check();
