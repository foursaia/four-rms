-- ============================================================
-- RESTAURANT MANAGEMENT SYSTEM — SUPABASE DATABASE SCHEMA
-- Version: 1.0  |  Currency: PKR  |  Country: Pakistan
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE order_type      AS ENUM ('dine_in', 'takeaway', 'delivery', 'qr_table');
CREATE TYPE order_source     AS ENUM ('kiosk', 'website', 'voice_agent', 'receptionist', 'qr_code', 'aggregator');
CREATE TYPE order_status     AS ENUM ('pending_payment', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_method   AS ENUM ('cash', 'card', 'cod');
CREATE TYPE payment_status   AS ENUM ('unpaid', 'paid', 'refunded', 'partial');
CREATE TYPE table_status     AS ENUM ('available', 'occupied', 'reserved');
CREATE TYPE staff_role       AS ENUM ('receptionist', 'kitchen', 'delivery_boy', 'manager', 'ceo', 'admin');
CREATE TYPE salary_structure AS ENUM ('fixed_monthly', 'hourly', 'fixed_plus_overtime');
CREATE TYPE salary_status    AS ENUM ('draft', 'reviewed', 'approved', 'paid');
CREATE TYPE expense_category AS ENUM ('rent', 'utilities', 'staff_salaries', 'raw_materials', 'packaging', 'maintenance', 'other');
CREATE TYPE ingredient_role  AS ENUM ('default', 'addon');
CREATE TYPE product_status   AS ENUM ('available', 'out_of_stock', 'hidden');
CREATE TYPE delivery_status  AS ENUM ('assigned', 'out_for_delivery', 'delivered');
CREATE TYPE cash_txn_type    AS ENUM ('cash_in', 'cash_out', 'opening', 'closing');
CREATE TYPE cancellation_reason AS ENUM ('customer_request', 'item_unavailable', 'duplicate_order', 'other');
CREATE TYPE broadcast_status AS ENUM ('draft', 'scheduled', 'sent', 'failed');
CREATE TYPE dietary_tag      AS ENUM ('vegetarian', 'contains_gluten', 'contains_dairy', 'contains_nuts', 'spicy', 'halal');
CREATE TYPE notification_type AS ENUM ('order_confirmed', 'order_ready', 'out_for_delivery', 'delivered', 'feedback_request', 'google_review', 'marketing', 'low_stock', 'peak_hour', 'cash_discrepancy', 'salary_slip', 'shift_schedule');

-- ============================================================
-- 1. BRANCHES
-- ============================================================


-- ============================================================
-- 1. BRANCHES
-- ============================================================

CREATE TABLE branches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    address         TEXT,
    phone           TEXT,
    whatsapp        TEXT,
    google_maps_url TEXT,
    google_review_url TEXT,
    logo_url        TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    timezone        TEXT NOT NULL DEFAULT 'Asia/Karachi',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. STAFF / USERS
-- ============================================================

CREATE TABLE staff (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    full_name       TEXT NOT NULL,
    staff_code      TEXT UNIQUE NOT NULL,            -- e.g. RMS-001
    role            staff_role NOT NULL,
    phone           TEXT,
    whatsapp        TEXT,
    pin_hash        TEXT,                            -- 2-step login PIN (hashed)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url      TEXT,
    created_by      UUID REFERENCES staff(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supabase Auth → Staff link (auth.users.id = staff.auth_user_id)
ALTER TABLE staff ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- 3. CUSTOMERS
-- ============================================================

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID REFERENCES branches(id),   -- NULL = cross-branch customer
    full_name       TEXT,
    whatsapp        TEXT UNIQUE,
    default_address TEXT,
    is_opted_out    BOOLEAN NOT NULL DEFAULT FALSE,  -- WhatsApp opt-out
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. CATEGORIES
-- ============================================================

CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    image_url       TEXT,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. PRODUCTS (MENU ITEMS)
-- ============================================================

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name            TEXT NOT NULL,
    description     TEXT,
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    image_url       TEXT,
    status          product_status NOT NULL DEFAULT 'available',
    is_beverage     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT NOT NULL DEFAULT 0,
    avg_prep_minutes INT NOT NULL DEFAULT 10,        -- for ETA calculation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. INGREDIENTS
-- ============================================================

CREATE TABLE ingredients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product ↔ Ingredient mapping
CREATE TABLE product_ingredients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    role            ingredient_role NOT NULL DEFAULT 'default',  -- default (removable) or addon
    UNIQUE(product_id, ingredient_id)
);

-- ============================================================
-- 7. ALLERGEN / DIETARY TAGS
-- ============================================================

CREATE TABLE product_dietary_tags (
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag             dietary_tag NOT NULL,
    PRIMARY KEY (product_id, tag)
);

-- ============================================================
-- 8. RECOMMENDED PAIRINGS (AI upsell / manual pins)
-- ============================================================

CREATE TABLE product_recommendations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    recommended_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    is_manual_pin   BOOLEAN NOT NULL DEFAULT FALSE,
    score           NUMERIC(5,4) DEFAULT 0,          -- collaborative filtering score
    UNIQUE(product_id, recommended_id)
);

-- ============================================================
-- 9. TABLES (FLOOR MAP)
-- ============================================================

CREATE TABLE restaurant_tables (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    table_number    TEXT NOT NULL,
    capacity        INT NOT NULL DEFAULT 4,
    status          table_status NOT NULL DEFAULT 'available',
    qr_code_url     TEXT,                            -- generated QR URL
    position_x      INT,                             -- for visual floor map
    position_y      INT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(branch_id, table_number)
);

-- ============================================================
-- 10. ORDERS
-- ============================================================

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    order_number    TEXT NOT NULL,                   -- daily sequential e.g. #0042
    order_type      order_type NOT NULL,
    order_source    order_source NOT NULL,
    status          order_status NOT NULL DEFAULT 'pending_payment',
    payment_method  payment_method,
    payment_status  payment_status NOT NULL DEFAULT 'unpaid',

    -- Relational links
    table_id        UUID REFERENCES restaurant_tables(id),
    customer_id     UUID REFERENCES customers(id),
    receptionist_id UUID REFERENCES staff(id),       -- who created / accepted

    -- Customer info (for delivery / voice orders without profile)
    customer_name   TEXT,
    customer_whatsapp TEXT,
    delivery_address TEXT,

    -- Financials
    subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL DEFAULT 0,

    -- Timing
    estimated_ready_at TIMESTAMPTZ,
    scheduled_for   TIMESTAMPTZ,                     -- pre-order scheduling
    confirmed_at    TIMESTAMPTZ,
    ready_at        TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,

    -- Flags
    is_voice_order  BOOLEAN NOT NULL DEFAULT FALSE,
    modification_window_expires_at TIMESTAMPTZ,      -- 2-min window

    external_order_id TEXT,                          -- e.g. Foodpanda order ID

    order_date      DATE NOT NULL DEFAULT CURRENT_DATE, -- for immutable daily tracking
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(branch_id, order_number, order_date)
);


-- FIX #1: Atomic daily counter — eliminates race condition on concurrent inserts
-- order_daily_seq removed (was unused and caused duplicate numbers)
CREATE TABLE order_daily_counters (
    branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    last_number INT  NOT NULL DEFAULT 0,
    PRIMARY KEY (branch_id, date)
);

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    next_num INT;
BEGIN
    INSERT INTO order_daily_counters (branch_id, date, last_number)
    VALUES (NEW.branch_id, NOW()::DATE, 1)
    ON CONFLICT (branch_id, date)
    DO UPDATE SET last_number = order_daily_counters.last_number + 1
    RETURNING last_number INTO next_num;

    NEW.order_number := LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_number
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================================
-- 11. ORDER ITEMS
-- ============================================================

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name    TEXT NOT NULL,                   -- snapshot at time of order
    unit_price      NUMERIC(10,2) NOT NULL,
    quantity        INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    line_total      NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    is_ready        BOOLEAN NOT NULL DEFAULT FALSE,  -- kitchen marks per item
    
    -- Print tracking
    print_count     INT NOT NULL DEFAULT 0,
    last_printed_at TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. ORDER ITEM CUSTOMISATIONS
-- ============================================================

CREATE TABLE order_item_customisations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id   UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    ingredient_id   UUID REFERENCES ingredients(id),
    ingredient_name TEXT NOT NULL,                   -- snapshot
    action          TEXT NOT NULL CHECK (action IN ('removed', 'added'))
);

-- ============================================================
-- 13. ORDER MODIFICATIONS LOG
-- ============================================================

CREATE TABLE order_modifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    modified_by     UUID NOT NULL REFERENCES staff(id),
    requires_manager_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by     UUID REFERENCES staff(id),
    change_summary  JSONB NOT NULL,                  -- before/after snapshot
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. CANCELLATIONS & REFUNDS
-- ============================================================

CREATE TABLE order_cancellations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    cancelled_by    UUID NOT NULL REFERENCES staff(id),
    reason          cancellation_reason NOT NULL,
    reason_note     TEXT,
    refund_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
    refund_method   payment_method,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. DELIVERY ASSIGNMENTS
-- ============================================================

CREATE TABLE delivery_assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    delivery_boy_id UUID NOT NULL REFERENCES staff(id),
    status          delivery_status NOT NULL DEFAULT 'assigned',
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    picked_up_at    TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ
);

-- ============================================================
-- 16. SHIFTS & ATTENDANCE
-- ============================================================

CREATE TABLE shifts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end   TIMESTAMPTZ NOT NULL,
    actual_start    TIMESTAMPTZ,
    actual_end      TIMESTAMPTZ,
    is_late         BOOLEAN NOT NULL DEFAULT FALSE,
    overtime_minutes INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to calculate shift stats (late arrival and overtime)
CREATE OR REPLACE FUNCTION calculate_shift_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Check if late (> 10 mins)
    IF NEW.actual_start IS NOT NULL AND NEW.actual_start > NEW.scheduled_start + INTERVAL '10 minutes' THEN
        NEW.is_late := TRUE;
    ELSE
        NEW.is_late := FALSE;
    END IF;

    -- Calculate overtime minutes
    IF NEW.actual_end IS NOT NULL AND NEW.actual_end > NEW.scheduled_end THEN
        NEW.overtime_minutes := EXTRACT(EPOCH FROM (NEW.actual_end - NEW.scheduled_end))::INT / 60;
    ELSE
        NEW.overtime_minutes := 0;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_shift_stats
BEFORE INSERT OR UPDATE ON shifts
FOR EACH ROW EXECUTE FUNCTION calculate_shift_stats();


-- ============================================================
-- 17. CASH DRAWER SESSIONS
-- ============================================================

CREATE TABLE cash_drawer_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    shift_id        UUID REFERENCES shifts(id),
    staff_id        UUID NOT NULL REFERENCES staff(id),
    opening_float   NUMERIC(10,2) NOT NULL,
    closing_float   NUMERIC(10,2),
    expected_closing NUMERIC(10,2),
    discrepancy     NUMERIC(10,2) GENERATED ALWAYS AS (
                        CASE WHEN closing_float IS NOT NULL AND expected_closing IS NOT NULL
                             THEN closing_float - expected_closing
                             ELSE NULL END
                    ) STORED,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ
);

-- ============================================================
-- 18. CASH TRANSACTIONS (cash-in / cash-out)
-- ============================================================

CREATE TABLE cash_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES cash_drawer_sessions(id) ON DELETE CASCADE,
    type            cash_txn_type NOT NULL,
    amount          NUMERIC(10,2) NOT NULL,
    note            TEXT,
    order_id        UUID REFERENCES orders(id),
    recorded_by     UUID NOT NULL REFERENCES staff(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 19. INVENTORY (Phase 2 ready — linked at schema level)
-- ============================================================

CREATE TABLE inventory_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    ingredient_id   UUID REFERENCES ingredients(id),
    name            TEXT NOT NULL,
    unit            TEXT NOT NULL DEFAULT 'pcs',     -- kg, pcs, liters, etc.
    current_qty     NUMERIC(10,3) NOT NULL DEFAULT 0,
    low_stock_threshold NUMERIC(10,3) NOT NULL DEFAULT 10,
    cost_per_unit   NUMERIC(10,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    change_qty      NUMERIC(10,3) NOT NULL,           -- negative = consumed
    reason          TEXT,
    order_id        UUID REFERENCES orders(id),
    recorded_by     UUID REFERENCES staff(id),
    receipt_url     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Budget per category per month
CREATE TABLE inventory_budgets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    item_id         UUID NOT NULL REFERENCES inventory_items(id),
    month_year      DATE NOT NULL,                   -- first day of month
    budget_amount   NUMERIC(10,2) NOT NULL,
    UNIQUE(branch_id, item_id, month_year)
);

-- ============================================================
-- 20. EXPENSES
-- ============================================================

CREATE TABLE expenses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    category        expense_category NOT NULL,
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    description     TEXT,
    receipt_url     TEXT,
    expense_date    DATE NOT NULL,
    recorded_by     UUID NOT NULL REFERENCES staff(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expense_budgets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    category        expense_category NOT NULL,
    month_year      DATE NOT NULL,
    budget_amount   NUMERIC(10,2) NOT NULL,
    UNIQUE(branch_id, category, month_year)
);

-- ============================================================
-- 21. SALARY PROFILES
-- ============================================================

CREATE TABLE salary_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    structure       salary_structure NOT NULL,
    base_salary     NUMERIC(10,2),                   -- monthly fixed
    hourly_rate     NUMERIC(10,2),
    overtime_rate   NUMERIC(10,2),                   -- per hour
    absent_deduction NUMERIC(10,2) DEFAULT 0,        -- per absent day
    late_deduction  NUMERIC(10,2) DEFAULT 0,         -- per late arrival
    payment_method  payment_method NOT NULL DEFAULT 'cash',
    effective_from  DATE NOT NULL,
    effective_to    DATE,                            -- NULL = current
    changed_by      UUID REFERENCES staff(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 22. SALARY RECORDS (monthly payroll)
-- ============================================================

CREATE TABLE salary_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    staff_id        UUID NOT NULL REFERENCES staff(id),
    profile_id      UUID NOT NULL REFERENCES salary_profiles(id),
    month_year      DATE NOT NULL,                   -- first day of month
    status          salary_status NOT NULL DEFAULT 'draft',

    -- Computed fields
    base_amount     NUMERIC(10,2) NOT NULL,
    overtime_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    gross_amount    NUMERIC(10,2) NOT NULL,
    absent_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
    late_deduction  NUMERIC(10,2) NOT NULL DEFAULT 0,
    advance_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_payable     NUMERIC(10,2) NOT NULL,

    -- Review
    reviewed_by     UUID REFERENCES staff(id),
    reviewed_at     TIMESTAMPTZ,
    approved_by     UUID REFERENCES staff(id),
    approved_at     TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    salary_slip_url TEXT,

    UNIQUE(staff_id, month_year)
);

CREATE TABLE salary_adjustments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salary_record_id UUID NOT NULL REFERENCES salary_records(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('bonus', 'penalty', 'advance_deduction', 'other')),
    amount          NUMERIC(10,2) NOT NULL,           -- positive = bonus, negative = deduction
    reason          TEXT NOT NULL,
    made_by         UUID NOT NULL REFERENCES staff(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 23. SALARY ADVANCES
-- ============================================================

CREATE TABLE salary_advances (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id        UUID NOT NULL REFERENCES staff(id),
    amount          NUMERIC(10,2) NOT NULL,
    given_on        DATE NOT NULL,
    note            TEXT,
    is_deducted     BOOLEAN NOT NULL DEFAULT FALSE,
    deducted_in     UUID REFERENCES salary_records(id),
    approved_by     UUID NOT NULL REFERENCES staff(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 24. CUSTOMER FEEDBACK
-- ============================================================

CREATE TABLE customer_feedback (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES customers(id),
    rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    google_review_requested BOOLEAN NOT NULL DEFAULT FALSE,
    google_review_sent_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 25. WHATSAPP NOTIFICATIONS LOG
-- ============================================================

CREATE TABLE notification_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    type            notification_type NOT NULL,
    recipient_phone TEXT NOT NULL,
    order_id        UUID REFERENCES orders(id),
    staff_id        UUID REFERENCES staff(id),
    message_body    TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','failed')),
    retry_count     INT NOT NULL DEFAULT 0,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 26. WHATSAPP MARKETING BROADCASTS
-- ============================================================

CREATE TABLE broadcasts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    title           TEXT NOT NULL,
    message_body    TEXT NOT NULL,
    image_url       TEXT,
    status          broadcast_status NOT NULL DEFAULT 'draft',
    audience_filter JSONB,                           -- {last_days:30, item_id: "uuid"}
    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    total_recipients INT,
    delivered_count INT DEFAULT 0,
    read_count      INT DEFAULT 0,
    created_by      UUID NOT NULL REFERENCES staff(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE broadcast_recipients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcast_id    UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed')),
    sent_at         TIMESTAMPTZ
);

-- ============================================================
-- 27. PEAK HOUR ALERTS CONFIG
-- ============================================================

CREATE TABLE peak_hour_config (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id) UNIQUE,
    threshold_orders INT NOT NULL DEFAULT 15,        -- orders per window
    window_minutes  INT NOT NULL DEFAULT 15,
    updated_by      UUID REFERENCES staff(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 28. SETTINGS & CONFIGURATIONS
-- ============================================================

CREATE TABLE branch_settings (
    branch_id       UUID PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
    tax_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    tax_rate        NUMERIC(5,2) DEFAULT 0,
    cash_on_delivery BOOLEAN NOT NULL DEFAULT TRUE,
    modification_window_seconds INT NOT NULL DEFAULT 120,
    avg_delivery_minutes INT NOT NULL DEFAULT 30,
    base_prep_minutes INT NOT NULL DEFAULT 10,
    low_stock_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    demand_forecast_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 29. DEMAND FORECAST
-- ============================================================

CREATE TABLE demand_forecasts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    forecast_date   DATE NOT NULL,
    expected_orders INT,
    top_items       JSONB,                           -- [{product_id, expected_qty}]
    staffing_recommendation TEXT,
    ingredient_recommendation TEXT,
    actual_orders   INT,                             -- filled after the day passes
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(branch_id, forecast_date)
);

-- ============================================================
-- 30. N8N WEBHOOK LOGS
-- ============================================================

CREATE TABLE n8n_webhook_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_name   TEXT NOT NULL,
    trigger_payload JSONB,
    response_status INT,
    response_body   JSONB,
    success         BOOLEAN,
    retries         INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HELPER FUNCTION: get current staff's role and branch
-- ============================================================

CREATE OR REPLACE FUNCTION auth_staff()
RETURNS TABLE(staff_id UUID, role staff_role, branch_id UUID) 
LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT s.id, s.role, s.branch_id
    FROM staff s
    WHERE s.auth_user_id = auth.uid()
      AND s.is_active = TRUE
    LIMIT 1;
$$;

-- ============================================================
-- 31. VOICE AGENT SESSIONS (FIX #10 — audit trail for Phase 5 calls)
-- ============================================================

CREATE TABLE voice_agent_sessions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id        UUID NOT NULL REFERENCES branches(id),
    order_id         UUID REFERENCES orders(id),
    twilio_call_sid  TEXT,                        -- Twilio unique call identifier
    caller_phone     TEXT,                        -- customer's incoming phone number
    transcript       TEXT,                        -- full AI conversation log
    parsed_order     JSONB,                       -- order JSON extracted by AI
    duration_seconds INT,
    success          BOOLEAN,                     -- TRUE = order placed successfully
    failure_reason   TEXT,                        -- reason if success = FALSE
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE voice_agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_sessions_select" ON voice_agent_sessions FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s
                   WHERE s.branch_id = voice_agent_sessions.branch_id
                     AND s.role IN ('ceo','admin','manager','receptionist')));

-- ============================================================
-- INDEXES (Performance)
-- ============================================================

CREATE INDEX idx_orders_branch_date     ON orders(branch_id, created_at DESC);
CREATE INDEX idx_orders_status          ON orders(status);
CREATE INDEX idx_orders_source          ON orders(order_source);
CREATE INDEX idx_orders_customer        ON orders(customer_id);
CREATE INDEX idx_order_items_order      ON order_items(order_id);
CREATE INDEX idx_shifts_staff           ON shifts(staff_id);
CREATE INDEX idx_shifts_branch_date     ON shifts(branch_id, scheduled_start DESC);
CREATE INDEX idx_cash_sessions_staff    ON cash_drawer_sessions(staff_id);
CREATE INDEX idx_expenses_branch_date   ON expenses(branch_id, expense_date DESC);
CREATE INDEX idx_salary_records_staff   ON salary_records(staff_id, month_year DESC);
CREATE INDEX idx_inventory_branch       ON inventory_items(branch_id);
CREATE INDEX idx_feedback_order         ON customer_feedback(order_id);
CREATE INDEX idx_notifications_branch   ON notification_logs(branch_id, created_at DESC);
CREATE INDEX idx_products_category      ON products(category_id);
CREATE INDEX idx_products_branch        ON products(branch_id);
-- FIX #6: Missing index on customers(whatsapp) — queried on every order, broadcast, and win-back campaign
CREATE INDEX idx_customers_whatsapp     ON customers(whatsapp);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_branches_updated         BEFORE UPDATE ON branches         FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_staff_updated            BEFORE UPDATE ON staff            FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_customers_updated        BEFORE UPDATE ON customers        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_categories_updated       BEFORE UPDATE ON categories       FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_products_updated         BEFORE UPDATE ON products         FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_orders_updated           BEFORE UPDATE ON orders           FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_inventory_updated        BEFORE UPDATE ON inventory_items  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
-- FIX #4: Missing updated_at triggers for salary_profiles and branch_settings
CREATE TRIGGER trg_salary_profiles_updated  BEFORE UPDATE ON salary_profiles  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_branch_settings_updated  BEFORE UPDATE ON branch_settings  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all sensitive tables
ALTER TABLE branches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_ingredients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_dietary_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_customisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_modifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_cancellations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawer_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_adjustments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- ─── BRANCHES ───────────────────────────────────────────────
-- CEO: all branches; others: their own branch only
CREATE POLICY "branches_select" ON branches FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.role = 'ceo'
                   OR s.branch_id = branches.id)
    );

CREATE POLICY "branches_insert" ON branches FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin')));

CREATE POLICY "branches_update" ON branches FOR UPDATE
    USING (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin')));

-- ─── STAFF ───────────────────────────────────────────────────
-- Manager: sees staff in their branch; CEO: all; each staff: sees own record
CREATE POLICY "staff_select" ON staff FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.role IN ('ceo','admin')
                   OR (s.role = 'manager' AND s.branch_id = staff.branch_id)
                   OR s.staff_id = staff.id)
    );

CREATE POLICY "staff_insert" ON staff FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.role IN ('ceo','admin')
                   OR (s.role = 'manager' AND s.branch_id = staff.branch_id))
    );

CREATE POLICY "staff_update" ON staff FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.role IN ('ceo','admin')
                   OR (s.role = 'manager' AND s.branch_id = staff.branch_id)
                   OR s.staff_id = staff.id)  -- own record (e.g. password change)
    );

-- ─── PRODUCTS / CATEGORIES / INGREDIENTS ────────────────────
-- Public read for kiosk/website; only manager/CEO can write

CREATE POLICY "categories_select_all" ON categories FOR SELECT USING (TRUE);
CREATE POLICY "products_select_all"   ON products   FOR SELECT USING (TRUE);
CREATE POLICY "ingredients_select_all" ON ingredients FOR SELECT USING (TRUE);
CREATE POLICY "product_ingredients_select" ON product_ingredients FOR SELECT USING (TRUE);
CREATE POLICY "dietary_tags_select"   ON product_dietary_tags FOR SELECT USING (TRUE);

CREATE POLICY "categories_write" ON categories FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.role IN ('ceo','admin','manager')
                          AND s.branch_id = categories.branch_id));

CREATE POLICY "products_write" ON products FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.role IN ('ceo','admin','manager')
                          AND s.branch_id = products.branch_id));

CREATE POLICY "product_ingredients_write" ON product_ingredients FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin','manager')));

-- ─── RESTAURANT TABLES ───────────────────────────────────────
CREATE POLICY "tables_select" ON restaurant_tables FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.branch_id = restaurant_tables.branch_id));

CREATE POLICY "tables_write" ON restaurant_tables FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.role IN ('ceo','admin','manager','receptionist')
                          AND s.branch_id = restaurant_tables.branch_id));

-- ─── ORDERS ──────────────────────────────────────────────────
-- Receptionist: own branch orders
-- Kitchen: own branch orders (read + update status)
-- Delivery boy: only delivery orders assigned to them
-- Manager / CEO: all orders in branch / all branches

CREATE POLICY "orders_select" ON orders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth_staff() s
            WHERE
                (s.role IN ('ceo','admin') )
                OR (s.role IN ('manager','receptionist','kitchen') AND s.branch_id = orders.branch_id)
                OR (s.role = 'delivery_boy' AND EXISTS (
                        SELECT 1 FROM delivery_assignments da
                        WHERE da.order_id = orders.id AND da.delivery_boy_id = s.staff_id))
        )
    );

CREATE POLICY "orders_insert" ON orders FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.role IN ('ceo','admin','manager','receptionist')
                  AND s.branch_id = orders.branch_id)
        OR orders.order_source IN ('kiosk','website','voice_agent','qr_code')  -- system-level inserts
    );

CREATE POLICY "orders_update" ON orders FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE (s.role IN ('ceo','admin','manager','receptionist') AND s.branch_id = orders.branch_id)
                   OR (s.role = 'kitchen' AND s.branch_id = orders.branch_id)
                   OR (s.role = 'delivery_boy' AND EXISTS (
                           SELECT 1 FROM delivery_assignments da
                           WHERE da.order_id = orders.id AND da.delivery_boy_id = s.staff_id)))
    );

-- ─── ORDER ITEMS ─────────────────────────────────────────────
CREATE POLICY "order_items_select" ON order_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM orders o
        JOIN auth_staff() s ON s.branch_id = o.branch_id
        WHERE o.id = order_items.order_id
    ));

CREATE POLICY "order_items_write" ON order_items FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.role IN ('ceo','admin','manager','receptionist')));

-- ─── ORDER CUSTOMISATIONS ────────────────────────────────────
-- FIX #5: Replaced fully open policy with scoped read/write/delete policies
CREATE POLICY "customisations_select" ON order_item_customisations
    FOR SELECT USING (TRUE);  -- reading is safe — no sensitive data

CREATE POLICY "customisations_insert" ON order_item_customisations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth_staff() s
            WHERE s.role IN ('ceo', 'admin', 'manager', 'receptionist')
        )
        OR current_setting('request.jwt.role', TRUE) = 'service_role'
    );

CREATE POLICY "customisations_delete" ON order_item_customisations
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.role IN ('ceo', 'admin', 'manager', 'receptionist'))
    );

-- ─── SHIFTS ──────────────────────────────────────────────────
CREATE POLICY "shifts_select" ON shifts FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s
                   WHERE s.branch_id = shifts.branch_id));

CREATE POLICY "shifts_write" ON shifts FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.role IN ('ceo','admin','manager')
                          AND s.branch_id = shifts.branch_id));

-- Kitchen staff can update their own shift (actual_start/end)
CREATE POLICY "shifts_self_update" ON shifts FOR UPDATE
    USING (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.staff_id = shifts.staff_id));

-- ─── CASH DRAWER ─────────────────────────────────────────────
CREATE POLICY "cash_sessions_select" ON cash_drawer_sessions FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s
                   WHERE s.branch_id = cash_drawer_sessions.branch_id
                     AND s.role IN ('ceo','admin','manager','receptionist')));

CREATE POLICY "cash_sessions_write" ON cash_drawer_sessions FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.branch_id = cash_drawer_sessions.branch_id
                          AND s.role IN ('admin','manager','receptionist')));

CREATE POLICY "cash_txn_select" ON cash_transactions FOR SELECT
    USING (EXISTS (SELECT 1 FROM cash_drawer_sessions cds
                   JOIN auth_staff() s ON s.branch_id = cds.branch_id
                   WHERE cds.id = cash_transactions.session_id
                     AND s.role IN ('ceo','admin','manager','receptionist')));

CREATE POLICY "cash_txn_insert" ON cash_transactions FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.role IN ('admin','manager','receptionist')));

-- ─── INVENTORY ───────────────────────────────────────────────
CREATE POLICY "inventory_select" ON inventory_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s
                   WHERE s.branch_id = inventory_items.branch_id));

CREATE POLICY "inventory_write" ON inventory_items FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.role IN ('ceo','admin','manager','kitchen')
                          AND s.branch_id = inventory_items.branch_id));

-- ─── EXPENSES ────────────────────────────────────────────────
CREATE POLICY "expenses_select" ON expenses FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s
                   WHERE s.branch_id = expenses.branch_id
                     AND s.role IN ('ceo','admin','manager')));

CREATE POLICY "expenses_write" ON expenses FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.branch_id = expenses.branch_id
                          AND s.role IN ('admin','manager')));

-- ─── SALARY ──────────────────────────────────────────────────
CREATE POLICY "salary_profiles_select" ON salary_profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s
                   WHERE s.role IN ('ceo','admin','manager')
                      OR s.staff_id = salary_profiles.staff_id));

CREATE POLICY "salary_profiles_write" ON salary_profiles FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin','manager')));

CREATE POLICY "salary_records_select" ON salary_records FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s
                   WHERE s.role IN ('ceo','admin','manager')
                      OR s.staff_id = salary_records.staff_id));  -- own slip

CREATE POLICY "salary_records_write" ON salary_records FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin','manager')));

CREATE POLICY "salary_adjustments_all" ON salary_adjustments FOR ALL
    USING (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin','manager')))
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin','manager')));

-- ─── SALARY ADVANCES ─────────────────────────────────────────
-- FIX #8: salary_advances had RLS enabled but NO policies — would block all access
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advances_select" ON salary_advances FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth_staff() s
            WHERE s.role IN ('ceo', 'admin', 'manager')
               OR s.staff_id = salary_advances.staff_id  -- staff sees own advance record
        )
    );

CREATE POLICY "advances_insert" ON salary_advances FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.role IN ('ceo', 'admin', 'manager'))
    );

CREATE POLICY "advances_update" ON salary_advances FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.role IN ('ceo', 'admin', 'manager'))
    );

-- ─── FEEDBACK ────────────────────────────────────────────────
CREATE POLICY "feedback_select" ON customer_feedback FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin','manager')));

CREATE POLICY "feedback_insert" ON customer_feedback FOR INSERT
    WITH CHECK (TRUE);   -- public insert (customer submits)

-- ─── NOTIFICATIONS ───────────────────────────────────────────
CREATE POLICY "notifications_select" ON notification_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s
                   WHERE s.branch_id = notification_logs.branch_id
                     AND s.role IN ('ceo','admin','manager')));

-- ─── BROADCASTS ──────────────────────────────────────────────
CREATE POLICY "broadcasts_select" ON broadcasts FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s
                   WHERE s.branch_id = broadcasts.branch_id
                     AND s.role IN ('ceo','admin','manager')));

CREATE POLICY "broadcasts_write" ON broadcasts FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s
                        WHERE s.branch_id = broadcasts.branch_id
                          AND s.role IN ('admin','manager')));

-- ─── DELIVERY ASSIGNMENTS ────────────────────────────────────
CREATE POLICY "delivery_assignments_select" ON delivery_assignments FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.role IN ('ceo','admin','manager','receptionist')
                   OR s.staff_id = delivery_assignments.delivery_boy_id)
    );

CREATE POLICY "delivery_assignments_update" ON delivery_assignments FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM auth_staff() s
                WHERE s.staff_id = delivery_assignments.delivery_boy_id
                   OR s.role IN ('admin','manager','receptionist'))
    );

-- ─── ORDER MODIFICATIONS ────────────────────────────────────
CREATE POLICY "modifications_select" ON order_modifications FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin','manager','receptionist')));

CREATE POLICY "modifications_write" ON order_modifications FOR ALL
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin','manager','receptionist')));

-- ─── ORDER CANCELLATIONS ─────────────────────────────────────
CREATE POLICY "cancellations_select" ON order_cancellations FOR SELECT
    USING (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('ceo','admin','manager','receptionist')));

CREATE POLICY "cancellations_insert" ON order_cancellations FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM auth_staff() s WHERE s.role IN ('admin','manager','receptionist')));

-- ============================================================
-- REALTIME PUBLICATIONS (Supabase Realtime)
-- ============================================================

-- Enable realtime on tables that need live push to panels
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE order_modifications;
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- ============================================================
-- SEED: Default Branch & Settings (FIX #3 — atomic DO block)
-- ============================================================
-- All seed rows inserted atomically — if any fail, all roll back.
-- Replace the phone number and address before running.

DO $$
DECLARE
    v_branch_id UUID;
BEGIN
    -- Insert main branch
    INSERT INTO branches (name, address, phone, whatsapp, timezone)
    VALUES (
        'Main Branch',
        'Karachi, Pakistan',
        '+92-XXX-XXXXXXX',
        '+92-XXX-XXXXXXX',
        'Asia/Karachi'
    )
    RETURNING id INTO v_branch_id;

    -- Insert default branch settings
    INSERT INTO branch_settings (branch_id)
    VALUES (v_branch_id);

    -- Insert default peak hour config (15 orders in 15 minutes triggers alert)
    INSERT INTO peak_hour_config (branch_id, threshold_orders, window_minutes)
    VALUES (v_branch_id, 15, 15);

    -- Initialise today's order counter
    INSERT INTO order_daily_counters (branch_id, date, last_number)
    VALUES (v_branch_id, CURRENT_DATE, 0);

    RAISE NOTICE 'RMS seed complete. Branch ID: %', v_branch_id;
END;
$$;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
