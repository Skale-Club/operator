// Targeted reverts for 32-01-PLAN.md (post-linter-revert state).
// Only the surgical edits mandated by the revision_context — no full rewrite.
const fs = require('fs');
const path = '.planning/phases/32-ghl-lost-lead-reengagement-sms-automation/32-01-PLAN.md';
let s = fs.readFileSync(path, 'utf8');

function replaceOne(haystack, needle, replacement, label) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) throw new Error('Anchor not found for: ' + label);
  const last = haystack.indexOf(needle, idx + needle.length);
  if (last !== -1) throw new Error('Multiple anchors for: ' + label);
  return haystack.replace(needle, replacement);
}

// ---- Edit 1: <interfaces> RunnerConfig comment block — strip the REVISED 2026-05-15 SMS executor swap header ----
{
  const needle = [
    '// REVISED 2026-05-15: SMS executor é agora sendSmsViaGhl (GHL Conversations API),',
    '// não Twilio. RunnerConfig perde `twilioIntegrationId` e ganha `fromNumberOverride`',
    '// opcional. Mesmo ghlCredentials serve para list e dispatch.',
    'export interface RunnerConfig {',
    '  orgId: string',
    '  locationId: string',
    '  ghlCredentials: GhlCredentials',
    '  fromNumberOverride?: string  // optional GHL_REENGAGEMENT_FROM_NUMBER if multi-number sub-account',
    '  messageTemplate: string',
    '  thresholdDays: number',
    '  batchLimit: number',
    '  runStartedAtIso: string',
    '}',
  ].join('\n');

  const rep = [
    '// SMS dispatch uses the Twilio executor sendSms (validated in v1.8). The Twilio',
    "// integration row is identified by env GHL_REENGAGEMENT_TWILIO_INTEGRATION_ID and",
    '// pre-flight matched against the org\'s active integrations row.',
    'export interface RunnerConfig {',
    '  orgId: string',
    '  locationId: string',
    '  ghlCredentials: GhlCredentials',
    '  twilioIntegrationId: string  // GHL_REENGAGEMENT_TWILIO_INTEGRATION_ID — pre-flight match required',
    '  messageTemplate: string',
    '  thresholdDays: number',
    '  batchLimit: number',
    '  runStartedAtIso: string',
    '}',
  ].join('\n');

  s = replaceOne(s, needle, rep, 'Edit 1 interfaces RunnerConfig comment + field');
}

// ---- Edit 2: Happy path test — revert from sendSmsViaGhl to sendSms (Twilio); restore non-E.164 skip context ----
{
  const needle = [
    '  // ---- Happy path ----',
    "  it('lists Lost opportunities older than threshold and dispatches SMS to each new contact', async () => {",
    '    // REVISED: SMS goes via sendSmsViaGhl, not Twilio.',
    '    // Plan 03: mock listOpportunities → FIXTURE_LOST_OLD_PAGE_1 + PAGE_2 merged',
    '    // mock sendSmsViaGhl → returns "SMS sent via GHL. ID: msg_..."',
    '    // mock supabase claim-first insert → returns inserted row',
    '    // assert result.processed === 5, result.sent === 5, result.failed === 0',
    "    // (non-E.164 phone skip removed — GHL uses contactId; phone format is GHL's problem)",
    "    expect.fail('Plan 03 must implement happy-path runner — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  const rep = [
    '  // ---- Happy path ----',
    "  it('lists Lost opportunities older than threshold and dispatches SMS via Twilio sendSms (skips non-E.164)', async () => {",
    '    // Plan 03: mock listOpportunities → FIXTURE_LOST_OLD_PAGE_1 + PAGE_2 merged',
    "    // mock sendSms (Twilio) → returns 'SMS sent. SID: SM...'",
    '    // mock supabase claim-first insert → returns inserted row',
    "    // ct_004 (non-E.164 phone '11999990004') must be skipped (reason='phone_invalid'),",
    '    // NOT counted as failed — Twilio rejects non-E.164 so we pre-skip per Pitfall 2.',
    '    // assert result.processed === 5, result.sent === 4, result.skipped === 1, result.failed === 0',
    "    expect.fail('Plan 03 must implement happy-path runner — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  s = replaceOne(s, needle, rep, 'Edit 2 happy path test');
}

// ---- Edit 3: REENG-04 contact extraction test ----
{
  const needle = [
    '  // ---- REENG-04: contact field extraction ----',
    "  it('passes contact.id and rendered body into sendSmsViaGhl params', async () => {",
    '    // Plan 03 must call sendSmsViaGhl({ contactId: opp.contact.id, body: rendered }, ghlCreds)',
    "    expect.fail('Plan 03 must pass contactId into sendSmsViaGhl — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  const rep = [
    '  // ---- REENG-04: contact field extraction ----',
    "  it('passes contact.phone and rendered body into sendSms params', async () => {",
    '    // Plan 03 must call sendSms({ to: opp.contact.phone, body: rendered }, ctx)',
    '    // where ctx is the ActionContext { supabase, organizationId, ... }.',
    "    expect.fail('Plan 03 must pass phone+body into sendSms — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  s = replaceOne(s, needle, rep, 'Edit 3 REENG-04 contact extraction');
}

// ---- Edit 4: REENG-11 claim-first rollback test ----
{
  const needle = [
    '  // ---- REENG-11: insert on success ----',
    "  it('claims the anti-loop row BEFORE sending, deletes on GHL failure (claim-first pattern)', async () => {",
    '    // Plan 03: mock supabase insert succeeds; mock sendSmsViaGhl throws',
    "    // Assert supabase.from('ghl_reengagement_sent').delete() is called with the just-inserted row id",
    '    // Assert result.failed >= 1',
    "    expect.fail('Plan 03 must implement claim-first rollback — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  const rep = [
    '  // ---- REENG-11: insert on success ----',
    "  it('claims the anti-loop row BEFORE sending, deletes on Twilio failure (claim-first pattern)', async () => {",
    '    // Plan 03: mock supabase insert succeeds; mock sendSms throws',
    "    // Assert supabase.from('ghl_reengagement_sent').delete() is called with the just-inserted row id",
    '    // Assert result.failed >= 1',
    "    expect.fail('Plan 03 must implement claim-first rollback — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  s = replaceOne(s, needle, rep, 'Edit 4 REENG-11 claim-first rollback');
}

// ---- Edit 5: logAction payload test — restore phone_masked design ----
{
  const needle = [
    "  it('logAction payload includes ghl_contact_id (opaque) and truncates body to 40 chars (T-32-03)', async () => {",
    '    // REVISED: phone is no longer in dispatch params — we pass contactId.',
    "    // Assert request_payload.ghl_contact_id === 'ct_001'",
    '    // Assert request_payload.message_rendered_first40.length <= 40',
    "    expect.fail('Plan 03 must log opaque contactId + truncated body — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  const rep = [
    "  it('logAction payload masks phone to ***last4 and truncates body to 40 chars (T-32-03)', async () => {",
    '    // Plan 03 must mask phone: request_payload.phone_masked matches /^\\*\\*\\*\\d{4}$/',
    "    //   (e.g., phone +5511999990001 → phone_masked: '***0001')",
    '    // Assert request_payload.ghl_contact_id is set and request_payload.message_rendered_first40.length <= 40',
    '    // Full phone and full body MUST NEVER appear in any logAction call.',
    "    expect.fail('Plan 03 must log masked phone + truncated body — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  s = replaceOne(s, needle, rep, 'Edit 5 logAction phone_masked');
}

// ---- Edit 6: logAction error test — wording: "GHL failure" → "Twilio failure" ----
{
  const needle = "  it('logAction on GHL failure: status=\"error\" + error_detail populated', async () => {";
  const rep    = "  it('logAction on Twilio failure: status=\"error\" + error_detail populated', async () => {";
  s = replaceOne(s, needle, rep, 'Edit 6 logAction error test');
}

// ---- Edit 7: Mixed success/failure allSettled test — keep wording but neutralise "one GHL fail" ----
{
  const needle = [
    "  it('mixed success/failure via Promise.allSettled — one GHL fail does not block others', async () => {",
    '    // Assert sent === 2, failed === 1, errors[0].ghl_contact_id and errors[0].error_message defined',
    "    expect.fail('Plan 03 must use allSettled — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  const rep = [
    "  it('mixed success/failure via Promise.allSettled — one Twilio fail does not block others', async () => {",
    '    // Assert sent === 2, failed === 1, errors[0].ghl_contact_id and errors[0].error_message defined',
    "    expect.fail('Plan 03 must use allSettled — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  s = replaceOne(s, needle, rep, 'Edit 7 allSettled mixed result test');
}

// ---- Edit 8: "GHL returns 4xx for contact with no phone" → non-E.164 skip ----
{
  const needle = [
    "  it('GHL returns 4xx for contact with no phone → counted as \"failed\" with error_detail', async () => {",
    "    // REVISED: phone format is GHL's concern; we pass contactId. If GHL contact has no",
    '    // phone or no SMS permission, GHL responds with 4xx — runner classifies as failed.',
    '    // Assert sendSmsViaGhl IS called for ct_004 (no pre-validation)',
    '    // Assert result.failed includes ct_004, errors[i].error_message includes GHL status',
    "    expect.fail('Plan 03 must let GHL surface phone errors — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  const rep = [
    "  it('non-E.164 phone (ct_004 phone=\"11999990004\") → counted as skipped(\"phone_invalid\"); sendSms NOT called', async () => {",
    '    // Pre-flight regex /^\\+[1-9]\\d{7,14}$/ rejects ct_004 before any Twilio call.',
    '    // Plan 03 must:',
    "    //   1. NOT call sendSms for ct_004 (assert sendSms not called with to: '11999990004')",
    '    //   2. NOT INSERT into ghl_reengagement_sent for ct_004 (retry possible after CRM cleanup)',
    "    //   3. Count it as skipped with errors[] entry containing reason='phone_invalid'",
    "    expect.fail('Plan 03 must skip non-E.164 phones — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  s = replaceOne(s, needle, rep, 'Edit 8 non-E.164 skip test');
}

// ---- Edit 9: missing firstName test — sendSmsViaGhl → sendSms ----
{
  const needle = [
    "  it('missing firstName → SMS body contains \"amigo(a)\"; dispatch succeeds', async () => {",
    '    // ct_003 has firstName: null',
    "    // Assert sendSmsViaGhl called for ct_003 with body containing 'amigo(a)'",
    "    expect.fail('Plan 03 must use amigo(a) fallback in dispatch — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  const rep = [
    "  it('missing firstName → SMS body contains \"amigo(a)\"; dispatch succeeds', async () => {",
    '    // ct_003 has firstName: null',
    "    // Assert sendSms called for ct_003 with body containing 'amigo(a)'",
    "    expect.fail('Plan 03 must use amigo(a) fallback in dispatch — test stub from Plan 01 Wave 0')",
    '  })',
  ].join('\n');

  s = replaceOne(s, needle, rep, 'Edit 9 missing firstName test');
}

// ---- Edit 10: REQUIRED_ENV constant — restore GHL_REENGAGEMENT_TWILIO_INTEGRATION_ID, strip REVISED comment ----
{
  const needle = [
    'const REQUIRED_ENV = [',
    "  'GHL_REENGAGEMENT_LOCATION_ID',",
    "  'GHL_REENGAGEMENT_INTEGRATION_ID',",
    "  'GHL_REENGAGEMENT_MESSAGE',",
    "  'GHL_REENGAGEMENT_TRIGGER_SECRET',",
    '] as const  // REVISED 2026-05-15: removed GHL_REENGAGEMENT_TWILIO_INTEGRATION_ID — SMS now via GHL',
  ].join('\n');

  const rep = [
    'const REQUIRED_ENV = [',
    "  'GHL_REENGAGEMENT_LOCATION_ID',",
    "  'GHL_REENGAGEMENT_INTEGRATION_ID',",
    "  'GHL_REENGAGEMENT_TWILIO_INTEGRATION_ID',",
    "  'GHL_REENGAGEMENT_MESSAGE',",
    "  'GHL_REENGAGEMENT_TRIGGER_SECRET',",
    '] as const',
  ].join('\n');

  s = replaceOne(s, needle, rep, 'Edit 10 REQUIRED_ENV constant');
}

// ---- Edit 11: acceptance_criteria additions for Task 3 ----
{
  const needle = "    - File contains the literal string `'GHL_REENGAGEMENT_TRIGGER_SECRET'`";
  const rep    = [
    "    - File contains the literal string `'GHL_REENGAGEMENT_TRIGGER_SECRET'`",
    "    - File contains the literal string `'GHL_REENGAGEMENT_TWILIO_INTEGRATION_ID'` (Twilio integration ID is mandatory per Phase 31 v1.8 dependency)",
    "    - File contains the literal string `phone_masked` and a regex `\\*\\*\\*\\d{4}` (masked-phone PII design)",
    "    - File contains the literal string `phone_invalid` (non-E.164 skip reason)",
  ].join('\n');
  s = replaceOne(s, needle, rep, 'Edit 11 acceptance_criteria additions');
}

// ---- Edit 12: sweep any remaining "REVISED 2026-05-15" lines tied to the SMS-executor swap ----
// (the only legitimate REVISED-style marker references automation_schedules — not present in Plan 01.)
{
  const lines = s.split('\n');
  const filtered = lines.filter(l => !/REVISED 2026-05-15|Revised 2026-05-15/.test(l));
  if (filtered.length !== lines.length) {
    console.log('Stripped extra REVISED 2026-05-15 lines:', lines.length - filtered.length);
  }
  s = filtered.join('\n');
}

// ---- Sanity check ----
const sendSmsViaGhlHits = (s.match(/sendSmsViaGhl/g) || []).length;
console.log('Remaining sendSmsViaGhl mentions:', sendSmsViaGhlHits);
const revisedHits = (s.match(/REVISED 2026-05-15|Revised 2026-05-15/g) || []).length;
console.log('Remaining REVISED 2026-05-15 lines:', revisedHits);
const hasPhoneMasked = /phone_masked/.test(s);
console.log('Has phone_masked:', hasPhoneMasked);
const hasPhoneInvalid = /phone_invalid/.test(s);
console.log('Has phone_invalid:', hasPhoneInvalid);
const hasTwilioEnv = /GHL_REENGAGEMENT_TWILIO_INTEGRATION_ID/.test(s);
console.log('Has GHL_REENGAGEMENT_TWILIO_INTEGRATION_ID:', hasTwilioEnv);
const hasSendSmsImport = /from '@\/lib\/twilio\/send-sms'/.test(s) || /from `@\/lib\/twilio\/send-sms`/.test(s);
console.log('Has Twilio sendSms import path:', hasSendSmsImport);

fs.writeFileSync(path, s, 'utf8');
console.log('OK. New length:', s.length);
