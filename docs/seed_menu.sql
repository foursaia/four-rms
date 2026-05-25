-- SEED DATA: Categories and Products for testing
DO $$
DECLARE
    v_branch_id UUID;
    v_cat_id_burger UUID;
    v_cat_id_pizza UUID;
    v_cat_id_drinks UUID;
BEGIN
    -- Get the main branch ID
    SELECT id INTO v_branch_id FROM branches LIMIT 1;

    -- 1. Insert Categories
    INSERT INTO categories (branch_id, name, sort_order)
    VALUES (v_branch_id, 'Burgers', 1) RETURNING id INTO v_cat_id_burger;

    INSERT INTO categories (branch_id, name, sort_order)
    VALUES (v_branch_id, 'Pizzas', 2) RETURNING id INTO v_cat_id_pizza;

    INSERT INTO categories (branch_id, name, sort_order)
    VALUES (v_branch_id, 'Beverages', 3) RETURNING id INTO v_cat_id_drinks;

    -- 2. Insert Products
    -- Burgers
    INSERT INTO products (branch_id, category_id, name, description, price, status)
    VALUES 
    (v_branch_id, v_cat_id_burger, 'Classic Beef Burger', 'Juicy beef patty with fresh lettuce and secret sauce.', 850, 'available'),
    (v_branch_id, v_cat_id_burger, 'Zinger Supreme', 'Crispy fried chicken breast with spicy mayo.', 750, 'available'),
    (v_branch_id, v_cat_id_burger, 'Double Cheese Delight', 'Two patties and three layers of premium melted cheese.', 1100, 'available');

    -- Pizzas
    INSERT INTO products (branch_id, category_id, name, description, price, status)
    VALUES 
    (v_branch_id, v_cat_id_pizza, 'Chicken Tikka Pizza', 'Traditional tikka chunks with onions and green chillies.', 1450, 'available'),
    (v_branch_id, v_cat_id_pizza, 'Beef Pepperoni', 'Premium beef pepperoni with mozzarella cheese.', 1650, 'available');

    -- Beverages
    INSERT INTO products (branch_id, category_id, name, description, price, status)
    VALUES 
    (v_branch_id, v_cat_id_drinks, 'Mint Margarita', 'Refreshing blend of fresh mint and lime.', 350, 'available'),
    (v_branch_id, v_cat_id_drinks, 'Classic Coke', 'Ice cold 330ml can.', 150, 'available');


    RAISE NOTICE 'Menu seeded successfully!';
END;
$$;
