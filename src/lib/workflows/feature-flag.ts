// SEED-025 Phase B: feature flag gating the unified workflow engine.
//
// While the flag is OFF, every resolver/executor reads from the legacy
// tool_configs table — behavior identical to pre-SEED-025.
//
// Flip the flag ON (env var UNIFIED_WORKFLOW_ENGINE=on) to route the same
// callsites through workflows WHERE kind='tool'. The resolver returns the
// same shape either way so callers do not change.

export function isUnifiedEngineEnabled(): boolean {
  return process.env.UNIFIED_WORKFLOW_ENGINE === 'on'
}
