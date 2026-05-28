-- Dashboard aggregate RPCs — run in Supabase SQL Editor
-- Revenue from paid installments this calendar month
CREATE OR REPLACE FUNCTION get_revenue_this_month()
RETURNS numeric AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM installments
  WHERE status = 'paid'
    AND date_trunc('month', paid_at) = date_trunc('month', now());
$$ LANGUAGE sql STABLE;

-- Revenue from all paid installments (overall)
CREATE OR REPLACE FUNCTION get_revenue_overall()
RETURNS numeric AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM installments
  WHERE status = 'paid';
$$ LANGUAGE sql STABLE;

-- Revenue from paid installments last calendar month (for delta)
CREATE OR REPLACE FUNCTION get_revenue_last_month()
RETURNS numeric AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM installments
  WHERE status = 'paid'
    AND date_trunc('month', paid_at) = date_trunc('month', now() - interval '1 month');
$$ LANGUAGE sql STABLE;

-- Total amount of all pending installments
CREATE OR REPLACE FUNCTION get_pending_total()
RETURNS numeric AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM installments
  WHERE status IN ('pending', 'overdue');
$$ LANGUAGE sql STABLE;

-- Count of pending installments
CREATE OR REPLACE FUNCTION get_pending_count()
RETURNS bigint AS $$
  SELECT COUNT(*)
  FROM installments
  WHERE status IN ('pending', 'overdue');
$$ LANGUAGE sql STABLE;

-- Total pipeline value (proposal-stage deals)
CREATE OR REPLACE FUNCTION get_pipeline_value()
RETURNS numeric AS $$
  SELECT COALESCE(SUM(value), 0)
  FROM deals
  WHERE stage = 'proposal';
$$ LANGUAGE sql STABLE;

-- Active deals count (proposal stage)
CREATE OR REPLACE FUNCTION get_active_deals_count()
RETURNS bigint AS $$
  SELECT COUNT(*)
  FROM deals
  WHERE stage = 'proposal';
$$ LANGUAGE sql STABLE;

-- Expenses this calendar month
CREATE OR REPLACE FUNCTION get_expenses_this_month()
RETURNS numeric AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM expenses
  WHERE date_trunc('month', expense_date::timestamptz) = date_trunc('month', now());
$$ LANGUAGE sql STABLE;

-- All expenses overall
CREATE OR REPLACE FUNCTION get_expenses_overall()
RETURNS numeric AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM expenses;
$$ LANGUAGE sql STABLE;
