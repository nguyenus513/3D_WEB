-- =============================================================================
-- Migration: Computed Fields — Trigger Maintenance
-- =============================================================================
-- Fixes the two DEFAULT-based computed fields that can drift after UPDATE:
--
--   1. orders.outstanding_amount = GREATEST(total_amount - deposit_amount, 0)
--      Currently: DEFAULT — only set on INSERT, stale after updates.
--      Fix: BEFORE UPDATE trigger recomputes it on every total_amount /
--           deposit_amount change.
--
--   2. orders.subtotal / total_amount sync
--      tg_recompute_order_amounts (already defined in schema_v2_enhancements.sql)
--      fires AFTER INSERT/UPDATE/DELETE on order_items and keeps
--      orders.subtotal + total_amount correct.
--
-- Note: order_items.total_price was confirmed to be a GENERATED ALWAYS AS column
-- in the live DB (error 428C9 received when trying to UPDATE it directly),
-- so no trigger is needed there — Postgres handles it automatically.
-- =============================================================================

-- =============================================================================
-- 1. GENERATED COLUMNS NOTE
-- =============================================================================
-- Both orders.outstanding_amount AND order_items.total_price are confirmed
-- GENERATED ALWAYS AS columns in the live database (error 428C9 received when
-- attempting to UPDATE either directly). Postgres recomputes these automatically
-- on every INSERT/UPDATE — no trigger or manual UPDATE needed.
--
-- orders.outstanding_amount  = GREATEST(total_amount - deposit_amount, 0)
-- order_items.total_price    = quantity * unit_price
-- =============================================================================

-- =============================================================================
-- 2. VERIFY: tg_recompute_order_amounts trigger exists
-- This was defined in 20260402_schema_v2_enhancements.sql.
-- Re-declare the function here as CREATE OR REPLACE (idempotent) to ensure
-- it is present even if the earlier migration was skipped.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tg_recompute_order_amounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  UPDATE public.orders o
  SET
    subtotal = COALESCE((
      SELECT SUM(oi.total_price)
      FROM public.order_items oi
      WHERE oi.order_id = v_order_id
    ), 0),
    total_amount = GREATEST(
      COALESCE((
        SELECT SUM(oi.total_price)
        FROM public.order_items oi
        WHERE oi.order_id = v_order_id
      ), 0)
      - COALESCE(o.discount, 0)
      + COALESCE(o.shipping_fee, 0),
      0
    ),
    updated_at = now()
  WHERE o.id = v_order_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_recompute_order_amounts ON public.order_items;
CREATE TRIGGER trg_order_items_recompute_order_amounts
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_order_amounts();

-- =============================================================================
-- 3. VERIFY: payment_status sync trigger
-- Re-declare idempotently (from schema_v2_enhancements.sql)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tg_sync_order_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_paid     numeric;
  v_total    numeric;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
  FROM public.payments
  WHERE order_id = v_order_id
    AND status = 'paid';

  SELECT total_amount
    INTO v_total
  FROM public.orders
  WHERE id = v_order_id;

  UPDATE public.orders
  SET
    payment_status = CASE
      WHEN v_paid <= 0                         THEN 'pending'
      WHEN v_paid < COALESCE(v_total, 0)       THEN 'partial'
      ELSE                                          'paid'
    END,
    paid_at = CASE
      WHEN v_paid >= COALESCE(v_total, 0) AND COALESCE(v_total, 0) > 0
           THEN COALESCE(paid_at, now())
      ELSE paid_at
    END,
    updated_at = now()
  WHERE id = v_order_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_sync_order_payment_status ON public.payments;
CREATE TRIGGER trg_payments_sync_order_payment_status
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_order_payment_status();

-- =============================================================================
-- COMMENTS
-- =============================================================================

-- tg_sync_outstanding_amount() removed — outstanding_amount is GENERATED ALWAYS AS

COMMENT ON FUNCTION public.tg_recompute_order_amounts()
  IS 'AFTER INSERT/UPDATE/DELETE on order_items: recomputes orders.subtotal and total_amount from line items.';

COMMENT ON FUNCTION public.tg_sync_order_payment_status()
  IS 'AFTER INSERT/UPDATE/DELETE on payments: recomputes orders.payment_status from sum of paid payments.';
