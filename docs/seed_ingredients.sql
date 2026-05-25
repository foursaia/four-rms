-- SEED DATA: Ingredients and Customisations
DO $$
DECLARE
    v_branch_id UUID;
    v_burger_id UUID;
    v_ing_onion UUID;
    v_ing_tomato UUID;
    v_ing_cheese UUID;
    v_ing_patty UUID;
BEGIN
    SELECT id INTO v_branch_id FROM branches LIMIT 1;
    SELECT id INTO v_burger_id FROM products WHERE name = 'Classic Beef Burger' LIMIT 1;

    -- 1. Create Global Ingredients
    INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'Fresh Onions') RETURNING id INTO v_ing_onion;
    INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'Sliced Tomatoes') RETURNING id INTO v_ing_tomato;
    INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'Extra Cheddar Cheese') RETURNING id INTO v_ing_cheese;
    INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'Extra Beef Patty') RETURNING id INTO v_ing_patty;

    -- 2. Link to Product (Burger)
    -- Defaults (Removable)
    INSERT INTO product_ingredients (product_id, ingredient_id, role) VALUES (v_burger_id, v_ing_onion, 'default');
    INSERT INTO product_ingredients (product_id, ingredient_id, role) VALUES (v_burger_id, v_ing_tomato, 'default');

    -- Add-ons (Optional)
    INSERT INTO product_ingredients (product_id, ingredient_id, role) VALUES (v_burger_id, v_ing_cheese, 'addon');
    INSERT INTO product_ingredients (product_id, ingredient_id, role) VALUES (v_burger_id, v_ing_patty, 'addon');

    RAISE NOTICE 'Ingredients seeded for Classic Beef Burger!';
END;
$$;
