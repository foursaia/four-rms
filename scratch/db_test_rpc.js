const url = 'https://maxjfweqbzdpcszvrrsc.supabase.co';
const key = 'sb_publishable_t29BkzUpkJ19lOc62MvACg_w2i5KFem';

async function check() {
  const res = await fetch(`${url}/rest/v1/rpc/test_query`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  console.log(res.status);
}
check();
