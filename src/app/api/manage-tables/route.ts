import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(request: Request) {
  try {
    const { tableId, position_x, position_y } = await request.json();

    if (!tableId || typeof position_x !== 'number' || typeof position_y !== 'number') {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('restaurant_tables')
      .update({ position_x, position_y })
      .eq('id', tableId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { branchId, table_number, capacity } = await request.json();

    if (!branchId || !table_number) {
      return NextResponse.json({ error: 'Branch ID and Table Number are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('restaurant_tables')
      .insert({
        branch_id: branchId,
        table_number,
        capacity: capacity || 4,
        status: 'available',
        position_x: 0,
        position_y: 0
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ table: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get('tableId');

    if (!tableId) {
      return NextResponse.json({ error: 'Table ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('restaurant_tables')
      .delete()
      .eq('id', tableId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
