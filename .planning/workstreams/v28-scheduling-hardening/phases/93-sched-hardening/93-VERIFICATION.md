# Phase 93 Verification — SCHED-HARDENING

**Result:** PASSED

## Checks

- [x] `supabase/migrations/072_scheduling_hardening.sql` exists with partial unique index DDL
- [x] `createBooking` maps Postgres `'23505'` to `{ ok: false, error: 'slot_taken' }`
- [x] `src/lib/rate-limit.ts` exists and exports `rateLimit` with fail-open contract
- [x] `createBooking` calls `rateLimit('booking:<ip>:<event_type_id>', 5, 3600)` before slot pre-check
- [x] `BookingForm` handles `rate_limited` toast distinctly from `slot_taken`
- [x] `npm run build` exits 0

## Notes

- Migration file created but **not applied** to remote Supabase — operator must run `npx supabase db push` separately (per CLAUDE.md flow).
- Rate limiter fails open when `REDIS_URL` is missing or Upstash is down — confirmed by reading `redis.isReady` and wrapping all calls in try/catch.
