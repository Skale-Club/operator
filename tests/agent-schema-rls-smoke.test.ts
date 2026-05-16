// tests/agent-schema-rls-smoke.test.ts
// Phase 33 Plan 01 — Wave 1 RED scaffold.
// Pins the RLS-enabled + (organization_id = get_current_org_id()) policy contract
// for every v2.0 agent-runtime table.
//
// Currently RED. Wave 2 (migrations 034-037) flips these GREEN.
//
// Implementation strategy: use a direct `pg` connection (SUPABASE_DB_URL env)
// to query pg_class.relrowsecurity + pg_policy. supabase-js cannot reach the
// pg_catalog schema, so the only ergonomic option is a raw postgres client.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'

const DB_URL = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL

const V20_AGENT_TABLES = [
  'agents',
  'agent_tools',
  'agent_partners',
  'agent_channel_defaults',
  'agent_prompt_versions',
  'agent_invocations',
] as const

let pg: Client | null = null

beforeAll(async () => {
  if (!DB_URL) {
    // Soft-skip fallback per plan acceptance criterion (NOT it.todo —
    // that would silently hide the contract). Test will report skipped.
    console.warn(
      '[agent-schema-rls-smoke] SUPABASE_DB_URL/DATABASE_URL not set — RLS smoke suite will skip. Set the env to run RLS verification against the remote DB.',
    )
    return
  }
  pg = new Client({ connectionString: DB_URL })
  await pg.connect()
}, 30000)

afterAll(async () => {
  if (pg) {
    await pg.end()
    pg = null
  }
})

const dbSuite = DB_URL ? describe : describe.skip

dbSuite('OBS-01 + TOOL-01 + DELEG-01 + AGENT-09 RLS isolation', () => {
  it.each(V20_AGENT_TABLES)(
    "%s has RLS enabled and the canonical (organization_id = get_current_org_id()) policy",
    async (table) => {
      // Wave 2 will migrate this assertion live. Until then: explicit RED.
      throw new Error(
        `MISSING — Wave 2 must enable RLS + add policy on '${table}' per D-33-02`,
      )

      // Reference implementation (uncomment in Wave 2 once migrations 034-037 land):
      // // 1. Verify RLS is enabled on the table
      // const relRes = await pg!.query<{ relrowsecurity: boolean }>(
      //   `SELECT c.relrowsecurity
      //      FROM pg_class c
      //      JOIN pg_namespace n ON n.oid = c.relnamespace
      //     WHERE n.nspname = 'public' AND c.relname = $1`,
      //   [table],
      // )
      // expect(relRes.rowCount).toBe(1)
      // expect(relRes.rows[0].relrowsecurity).toBe(true)
      //
      // // 2. Verify at least one policy exists whose USING expression references
      // //    the canonical get_current_org_id() helper from migration 001.
      // const polRes = await pg!.query<{ polname: string; using_expr: string | null }>(
      //   `SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
      //      FROM pg_policy
      //     WHERE polrelid = (
      //       SELECT c.oid
      //         FROM pg_class c
      //         JOIN pg_namespace n ON n.oid = c.relnamespace
      //        WHERE n.nspname = 'public' AND c.relname = $1
      //     )`,
      //   [table],
      // )
      // expect(polRes.rowCount).toBeGreaterThanOrEqual(1)
      // const matches = polRes.rows.filter(
      //   (r) => r.using_expr?.includes('get_current_org_id') ?? false,
      // )
      // expect(matches.length).toBeGreaterThanOrEqual(1)
    },
  )
})
