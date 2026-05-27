-- ─────────────────────────────────────────
-- UPDATE 1: Simplify deal pipeline stages
-- ─────────────────────────────────────────
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;

UPDATE deals SET stage = 'proposal' WHERE stage IN ('lead', 'negotiation', 'paused');

ALTER TABLE deals ADD CONSTRAINT deals_stage_check CHECK (stage IN ('proposal', 'won', 'lost'));

-- Also update the default
ALTER TABLE deals ALTER COLUMN stage SET DEFAULT 'proposal';

-- ─────────────────────────────────────────
-- UPDATE 2: Monthly retainer deal type
-- ─────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_type text DEFAULT 'one_time' CHECK (deal_type IN ('one_time', 'retainer'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS retainer_amount numeric(12,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS retainer_billing_day integer CHECK (retainer_billing_day BETWEEN 1 AND 31);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS retainer_start_date date;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS retainer_end_date date;

-- Backfill deal_type for existing rows
UPDATE deals SET deal_type = 'one_time' WHERE deal_type IS NULL;
