# Testing Patterns

**Analysis Date:** 2026-04-02
**Status:** Pre-implementation — no test files exist yet. All entries are planned or mandated by project documentation. Planned items reflect the conventions and requirements established in `.planning/` documents.

---

## Test Strategy

**Core principle:** Testing must verify multi-tenant data isolation above everything else. A bug that lets Organization A read Organization B's data is a catastrophic failure — no automated test for cross-org isolation means the system ships with an unacceptable risk.

**Priority order (from `PITFALLS.md` and `VOICEOPS_MASTER_PROMPT.md`):**

1. **Cross-organization data isolation** — automated tests that create two orgs, insert data as org A, query as org B, and assert zero results. Required for every table with `organization_id`.
2. **Action Engine end-to-end** — full round-trip: Vapi triggers tool → Edge Function executes → result returns to Vapi within 500ms. This is the platform's core value.
3. **Credential encryption cycle** — save credentials → inspect DB (must be ciphertext) → decrypt → use. Verifies AES-256-GCM encryption works end-to-end.
4. **Edge Function runtime compatibility** — all `/api/vapi/*` routes must be tested in the actual Edge Runtime, not just local Node.js dev.
5. **RLS policy coverage** — every table must have SELECT, INSERT, UPDATE, DELETE policies verified by test.

**Planned test execution phases:**
- Phase 1 (Foundation): RLS isolation test harness established
- Phase 2 (Action Engine): End-to-end tool execution tests, credential encryption tests, Edge Function latency tests
- Phase 6 (Polish): Full end-to-end test suite referenced in `VOICEOPS_MASTER_PROMPT.md §10`

---

## Test Types & Coverage

### Integration Tests (Highest Priority)

**Cross-org RLS isolation tests** — must exist before any feature ships:

Planned pattern per `PITFALLS.md §Pitfall 2`:
```typescript
// For every table with organization_id, verify:
// 1. Create two orgs
// 2. Insert row as org_a_user
// 3. Query as org_b_user
// 4. Assert: result is empty (RLS blocked the query)
test('org B cannot read org A call logs', async () => {
  const { orgA, orgB } = await createTestOrgs();
  await insertCallLog({ org: orgA, callId: 'test-call-1' });

  const { data } = await supabaseAs(orgB).from('call_logs').select();
  expect(data).toHaveLength(0);
});
```

Tables requiring isolation tests (from database schema in `VOICEOPS_MASTER_PROMPT.md §4`):
- `users`
- `assistant_mappings`
- `integrations`
- `tools_config`
- `knowledge_documents`
- `knowledge_chunks`
- `outbound_campaigns`
- `outbound_contacts`
- `call_logs`
- `action_logs`

**RLS policy completeness** — each table must have all four operations covered:
- `SELECT` policy with `USING` clause
- `INSERT` policy with `WITH CHECK` clause
- `UPDATE` policy with both `USING` and `WITH CHECK` (prevents changing `organization_id` to another org)
- `DELETE` policy with `USING` clause

**Action Engine end-to-end test** (Phase 2):
```
POST /api/vapi/tools
  → resolves org by assistantId
  → fetches tool_config
  → executes GHL action
  → logs to action_logs
  → returns { results: [...] } within 500ms
```

**Credential encryption cycle test** (Phase 2):
```
1. POST /api/integrations with { api_key: 'test-key' }
2. SELECT credentials FROM integrations WHERE id = $1
3. Assert: stored value is NOT 'test-key' (ciphertext)
4. Call decrypt(storedValue, ENCRYPTION_KEY)
5. Assert: decrypted value equals 'test-key'
```

**Campaign race condition test** (Phase 5, from `PITFALLS.md §Pitfall 9`):
```
Run 3 concurrent dialing workers against same contact list
Assert: each contact appears exactly once in call attempts
Assert: no duplicate vapi_call_id for same contact
```

### Unit Tests

Planned for pure logic functions in `src/lib/`:
- `src/lib/encryption.ts` — encrypt/decrypt round-trip with known inputs
- `src/lib/embeddings.ts` — chunking logic (chunk size ~500 tokens, overlap, edge cases)
- `src/lib/actions/*.ts` — individual executor functions with mocked HTTP responses
- Vapi webhook payload parsing (`src/lib/vapi/types.ts` validation via Zod schemas)

### Performance Tests

**Vapi tool-call latency** — the 500ms budget is a hard requirement (ACTN-12):
```
Measure P95 latency for full tool-call round-trip:
  Edge Function receives → DB lookup → external API call → DB log → response

Budget breakdown:
  ~5ms   webhook signature validation
  ~50ms  DB lookup (assistant_mapping → org + tool_config)
  ~300ms external API call (GHL, Cal.com)
  ~50ms  fire-and-forget log (EdgeRuntime.waitUntil)
  ≤ 400ms total synchronous path
```

**pgvector knowledge base query** (Phase 4, from `PITFALLS.md §Pitfall 7`):
```
Target: < 200ms with 10,000 vectors across multiple orgs
Verify: HNSW index is used (not sequential scan) via EXPLAIN ANALYZE
Verify: organization_id filter applied before vector search
```

**Dashboard query performance** (Phase 3, from `PITFALLS.md §Pitfall 8`):
```
Target: < 500ms with 10,000+ rows in call_logs
Verify: cursor-based pagination (not offset)
Verify: time-based index on created_at is used
```

### Security Tests

**Vapi webhook authentication:**
```
Send POST to /api/vapi/tools without X-Vapi-Secret header
Assert: 401 response, no action executed
```

**Service role key boundary:**
```
Verify SUPABASE_SERVICE_ROLE_KEY never appears in:
- Client-side bundle (via bundle analyzer)
- Any NEXT_PUBLIC_ prefixed variable
- API response bodies
```

**organization_id trust boundary:**
```
POST /api/vapi/tools with forged organization_id in payload body
Assert: platform derives org from assistantId mapping, ignores body org_id
```

**Credential never exposed in responses:**
```
GET /api/integrations/:id
Assert: response.credentials does not contain plain-text api_key
Assert: response shows masked value (••••last4) or nothing
```

---

## Testing Tools

**Planned framework:**
- Planned: Vitest or Jest (not yet selected — to be decided at project setup in Phase 1)
- Planned: `@supabase/supabase-js` for integration tests against a local Supabase instance

**Planned run commands:**
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode during development
npm run test:coverage     # Generate coverage report
```

**Local Supabase for integration tests:**
```bash
supabase start            # Start local Supabase (PostgreSQL + Auth + Edge Functions)
supabase db reset         # Reset to migration state before each test run
```

**Edge Function testing:**
```bash
supabase functions serve  # Local Edge Function runner (Deno runtime — not Node.js)
# Use with ngrok or vapi listen for Vapi webhook testing:
vapi listen --forward-to localhost:54321/functions/v1/vapi-tools
```

**Type generation** (must run after schema migrations):
```bash
supabase gen types typescript --local > src/types/database.types.ts
```

---

## CI/CD Integration

**Pipeline** (planned — `.github/workflows/deploy.yml` and `preview.yml` from `VOICEOPS_MASTER_PROMPT.md §7`):

```yaml
# On push to main:
jobs:
  lint-and-build:
    - npm run lint              # ESLint
    - npx tsc --noEmit          # TypeScript type check
    - npm run build             # Next.js production build

  deploy:
    needs: lint-and-build
    - vercel build --prod
    - vercel deploy --prebuilt --prod

# On pull request to main:
jobs:
  preview:
    - npm run lint
    - npx tsc --noEmit
    - vercel build
    - vercel deploy             # Preview URL
```

**Note:** The current CI pipeline (from project docs) includes lint, type check, and build — but does not yet include an automated test run step. Running `npm test` should be added to the `lint-and-build` job when tests are written in Phase 1/2.

**GitHub Secrets required:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

---

## Quality Gates

**These checks must pass before any code merges (from `VOICEOPS_MASTER_PROMPT.md §11` and CI pipeline):**

| Gate | Command | Must Pass |
|------|---------|-----------|
| TypeScript strict mode | `npx tsc --noEmit` | No errors, no `any`, no `@ts-ignore` |
| ESLint | `npm run lint` | Zero warnings (strict mode) |
| Build | `npm run build` | Zero build errors |
| Planned: Unit tests | `npm run test` | 100% pass |
| Planned: RLS isolation | Cross-org test suite | Zero cross-tenant data leaks |

**"Looks Done But Isn't" checklist** (from `PITFALLS.md` — required verification before each phase ships):

- [ ] Every new table has `ENABLE ROW LEVEL SECURITY` in its migration
- [ ] Every RLS policy has `USING` and `WITH CHECK` for both read and write operations
- [ ] Every `UPDATE` policy prevents changing `organization_id` to another org
- [ ] All `/api/vapi/*` routes have `export const runtime = 'edge'` and are tested in Deno/Edge runtime
- [ ] Vapi webhook secret validation works on deployed URL (not just localhost)
- [ ] Automated cross-org isolation test exists for every table with `organization_id`
- [ ] Credential save → DB inspect (ciphertext) → decrypt cycle works end-to-end
- [ ] No duplicate contacts in campaign load test (concurrent workers)
- [ ] Knowledge base semantic search returns zero results from other orgs
- [ ] Dashboard metrics load in < 500ms with 10K+ rows in call_logs
- [ ] Tool execution full round-trip tested: Vapi triggers → response within 500ms

**Coverage targets:**
- Planned: No formal percentage target established yet
- Critical paths requiring test coverage regardless of overall percentage:
  - All RLS policies (every table, all four operations)
  - Credential encryption/decryption cycle
  - Action Engine routing logic (`src/app/api/vapi/tools/route.ts`)
  - Cross-org isolation (every table with `organization_id`)

---

## Test Data Patterns

**Organization factory** (planned pattern for integration tests):
```typescript
// Creates isolated org with admin user — use in beforeEach
async function createTestOrg(slug: string) {
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .insert({ name: `Test Org ${slug}`, slug })
    .select()
    .single();

  const { data: { user } } = await supabaseAdmin.auth.admin.createUser({
    email: `admin-${slug}@test.voiceops.dev`,
    password: 'test-password',
  });

  await supabaseAdmin.from('users').insert({
    id: user.id,
    organization_id: org.id,
    role: 'admin',
  });

  return { org, user };
}
```

**Test webhook payload** (Vapi tool-call format, from `VOICEOPS_MASTER_PROMPT.md §6`):
```typescript
const mockVapiToolCallPayload = {
  message: {
    toolCalls: [{
      id: 'test-tool-call-id',
      function: {
        name: 'add_to_crm',
        arguments: { first_name: 'John', phone: '+15085551234' }
      }
    }],
    call: {
      assistantId: 'test-vapi-assistant-id'
    }
  }
};
```

**Test fixture location:** Planned in `src/__tests__/fixtures/` or co-located `__fixtures__/` directories (to be decided at setup).

---

*Testing analysis: 2026-04-02*
