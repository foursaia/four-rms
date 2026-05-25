import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId');

  if (!branchId) {
    return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('restaurant_tables')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('table_number', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tables: data });
}

export async function POST(request: Request) {
  try {
    const { branchId } = await request.json();

    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 });
    }

    const sampleTables = Array.from({ length: 12 }, (_, i) => ({
      branch_id: branchId,
      table_number: (i + 1).toString(),
      capacity: i % 2 === 0 ? 4 : 2,
      status: 'available',
      position_x: 0,
      position_y: 0
    }));

    // Use Upsert to prevent duplicate errors
    const { error } = await supabaseAdmin.from('restaurant_tables').upsert(sampleTables, { onConflict: 'branch_id,table_number' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
