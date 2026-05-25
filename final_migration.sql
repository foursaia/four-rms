-- RMS Final Database Migration
-- Execute this in the Supabase SQL Editor

-- 1. Add Peak Hour Configuration to global_settings
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS peak_hour_start TIME WITHOUT TIME ZONE DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS peak_hour_end TIME WITHOUT TIME ZONE DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS peak_hour_multiplier NUMERIC DEFAULT 1.2;

-- 2. Validate any other missing configurations
-- (Run a quick check to see if your product_ingredients table has the correct schema)
-- The low stock system now uses `product_ingredients` joined with `ingredients`.
-- If you haven't seeded default settings, run this:
INSERT INTO public.global_settings (id, maintenance_mode, audio_alerts, tax_percentage, session_timeout, primary_color, peak_hour_start, peak_hour_end, peak_hour_multiplier)
SELECT 1, false, true, 18, 60, '#EAB308', '18:00', '22:00', 1.2
WHERE NOT EXISTS (SELECT 1 FROM public.global_settings WHERE id = 1);

-- Note: The dummy session authentication uses cookies instead of database sessions,
-- so no database schema changes are required for the Route Guards / Middleware.

-- ============================================================
-- 3. Shifts Table (Cash Drawer Sessions)
--    Create if it doesn't already exist in your DB.
--    If it already exists, the IF NOT EXISTS clause is safe.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shifts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  opened_by        UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  closed_by        UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  opening_float    NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_float    NUMERIC(10,2),
  expected_cash    NUMERIC(10,2),
  actual_cash      NUMERIC(10,2),
  closing_notes    TEXT,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at        TIMESTAMPTZ
);

-- RLS for shifts
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shifts_all" ON public.shifts;
CREATE POLICY "shifts_all" ON public.shifts FOR ALL USING (true);

-- ============================================================
-- 4. Cash Transactions Table (per-shift cash movement log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id   UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('cash_in', 'cash_out', 'opening', 'sale')),
  amount     NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for cash_transactions
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_transactions_all" ON public.cash_transactions;
CREATE POLICY "cash_transactions_all" ON public.cash_transactions FOR ALL USING (true);

-- Index for fast shift lookup
CREATE INDEX IF NOT EXISTS idx_cash_transactions_shift ON public.cash_transactions(shift_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_branch_status    ON public.shifts(branch_id, status, opened_at DESC);

-- ============================================================
-- 5. Add closing_notes column if shifts table already existed
--    (safe to run even if column already exists)
-- ============================================================
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS closing_notes TEXT;
