import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log("--> API /api/ingredients HIT");
  
  try {
    const body = await request.json();
    console.log("--> Body parsed:", body);
    
    const { name, unit, branch_id } = body;

    if (!name || !branch_id) {
      console.error("--> Missing params");
      return NextResponse.json({ error: 'Name and Branch ID are required' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error("--> Missing env variables!");
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    console.log("--> Sending request to Supabase REST API...");
    
    // Use raw fetch to avoid any supabase-js client hangs in the API route
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ingredients`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: name.trim(),
        unit: unit || 'pcs',
        branch_id: branch_id
      })
    });

    const responseText = await res.text();
    console.log("--> Supabase Response status:", res.status);
    console.log("--> Supabase Response body:", responseText);

    if (!res.ok) {
      console.error("--> Supabase Error:", responseText);
      return NextResponse.json({ error: `Supabase Error: ${responseText}` }, { status: res.status });
    }

    const data = JSON.parse(responseText);
    
    // return=representation returns an array
    const insertedItem = Array.isArray(data) ? data[0] : data;

    console.log("--> Success! Returning item:", insertedItem);
    return NextResponse.json({ data: insertedItem });
    
  } catch (error: any) {
    console.error("--> Fatal API Error:", error);
    return NextResponse.json({ error: error.message || 'Unknown server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Ingredient ID is required' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/ingredients?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Failed to delete ingredient: ${err}` }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
