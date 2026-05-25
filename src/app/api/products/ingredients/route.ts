import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, ingredients } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // We use a raw fetch approach for SupabaseAdmin to guarantee it doesn't freeze in Next.js
    
    // 1. Delete existing
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/product_ingredients?product_id=eq.${productId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!delRes.ok) {
      const err = await delRes.text();
      return NextResponse.json({ error: `Failed to clear old ingredients: ${err}` }, { status: delRes.status });
    }

    // 2. Insert new
    if (ingredients && ingredients.length > 0) {
      const mappedIngredients = ingredients.map((pi: any) => ({
        product_id: productId,
        ingredient_id: pi.ingredient_id,
        role: pi.role,
        price_adjustment: pi.price_adjustment || 0,
        removal_reduction: pi.removal_reduction || 0
      }));

      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/product_ingredients`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(mappedIngredients)
      });

      if (!insRes.ok) {
        const err = await insRes.text();
        return NextResponse.json({ error: `Failed to save new ingredients: ${err}` }, { status: insRes.status });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
