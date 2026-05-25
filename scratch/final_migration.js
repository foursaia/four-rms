const { Client } = require('pg');

// Using the direct IPv6 address resolved via nslookup
const connectionString = 'postgresql://postgres:saadareebiqraaroob4@[2406:da12:b78:de18:ba1d:8167:d07d:3706]:5432/postgres';

async function runMigration() {
  console.log('Connecting to database via IPv6 address...');
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase Postgres!');

    // 1. Add shift closing fields
    console.log('Adding shift closing fields...');
    await client.query(`
      ALTER TABLE IF EXISTS shifts 
      ADD COLUMN IF NOT EXISTS closing_float NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS expected_cash NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS closing_notes TEXT;
    `);

    // 2. Create the place_kiosk_order RPC for transactional safety
    console.log('Creating place_kiosk_order RPC...');
    await client.query(`
      CREATE OR REPLACE FUNCTION place_kiosk_order(
        p_branch_id UUID,
        p_order_type TEXT,
        p_table_number TEXT,
        p_payment_method TEXT,
        p_payment_status TEXT,
        p_total NUMERIC,
        p_items JSONB
      ) RETURNS JSONB AS $$
      DECLARE
        v_order_id UUID;
        v_order_number TEXT;
        v_item RECORD;
        v_cust RECORD;
        v_order_item_id UUID;
      BEGIN
        -- Insert Order
        INSERT INTO orders (
          branch_id,
          order_type,
          table_number,
          order_source,
          status,
          payment_method,
          payment_status,
          total,
          subtotal
        ) VALUES (
          p_branch_id,
          p_order_type::order_type,
          p_table_number,
          'kiosk',
          'confirmed',
          p_payment_method::payment_method,
          p_payment_status::payment_status,
          p_total,
          p_total
        ) RETURNING id, order_number INTO v_order_id, v_order_number;

        -- Loop through items
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
          product_id UUID,
          product_name TEXT,
          price NUMERIC,
          quantity INT,
          customisations JSONB
        ) LOOP
          -- Insert Order Item
          INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            unit_price,
            quantity
          ) VALUES (
            v_order_id,
            v_item.product_id,
            v_item.product_name,
            v_item.price,
            v_item.quantity
          ) RETURNING id INTO v_order_item_id;

          -- Insert Customisations if any
          IF v_item.customisations IS NOT NULL AND jsonb_array_length(v_item.customisations) > 0 THEN
            FOR v_cust IN SELECT * FROM jsonb_to_recordset(v_item.customisations) AS c(
              ingredient_id UUID,
              ingredient_name TEXT,
              action TEXT
            ) LOOP
              INSERT INTO order_item_customisations (
                order_item_id,
                ingredient_id,
                ingredient_name,
                action
              ) VALUES (
                v_order_item_id,
                v_cust.ingredient_id,
                v_cust.ingredient_name,
                v_cust.action
              );
            END LOOP;
          END IF;
        END LOOP;

        RETURN jsonb_build_object(
          'id', v_order_id,
          'order_number', v_order_number
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Order failed: %', SQLERRM;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
