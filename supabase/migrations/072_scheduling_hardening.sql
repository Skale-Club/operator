-- =============================================================================
-- Migration 072: Scheduling Hardening — prevent double-booking at the DB level
--
-- Adds a partial unique index on (event_type_id, start_at) restricted to
-- status='confirmed', so concurrent inserts for the same slot fail with
-- 23505 (unique_violation) which the application maps to slot_taken.
--
-- Why partial: cancelled bookings should not block a future re-book of the
-- same slot. Only confirmed bookings must be unique per (event_type, start).
--
-- Idempotent: safe to re-run.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_event_slot_unique
  ON public.bookings (event_type_id, start_at)
  WHERE status = 'confirmed';

-- =============================================================================
-- Footer
--
-- Behavior:
--   INSERT INTO bookings (event_type_id, start_at, status='confirmed', ...)
--   --> if another confirmed booking already exists for that (event_type, start),
--       Postgres raises 23505 unique_violation. The application's createBooking
--       server action maps that to { ok: false, error: 'slot_taken' }.
--
--   UPDATE bookings SET status='cancelled' ...
--   --> drops the row out of the partial index, freeing the slot for re-booking.
-- =============================================================================
