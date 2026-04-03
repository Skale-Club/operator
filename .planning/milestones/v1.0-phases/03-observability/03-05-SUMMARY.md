---
phase: 03-observability
plan: "05"
subsystem: call-detail-ui
tags: [timeline, transcript, tool-badges, server-component, pure-function]
dependency_graph:
  requires: [03-04]
  provides: [buildTimeline-function, call-detail-page, call-transcript-component]
  affects: []
tech_stack:
  added: []
  patterns: [pure function, discriminated union, chat bubble UI, inline tool badges]
key_files:
  created:
    - src/lib/calls/timeline.ts
    - src/app/(dashboard)/calls/[callId]/page.tsx
    - src/components/calls/call-transcript.tsx
    - src/components/calls/call-detail-header.tsx
  modified: []
decisions:
  - "buildTimeline is pure — no React/Next.js imports, fully unit-testable"
  - "Turn filter: only role === 'user' || role === 'assistant' (excludes tool-call roles)"
  - "Turn offset: t.secondsFromStart ?? 0 (guards undefined)"
  - "Tool offset: (log.created_at ms - callStartedAt ms) / 1000"
  - "Sorted ascending by offset — turns + tools interleaved chronologically"
  - "notFound() if call row not found by id"
  - "action_logs fetched by vapi_call_id (TEXT equality — both columns are TEXT)"
metrics:
  duration: "10m"
  completed: "2026-04-02"
  tasks_completed: 2
  files_changed: 4
---

# Phase 3 Plan 05: Call Detail + Transcript Summary

One-liner: Pure buildTimeline function merging transcript turns and action_logs by time offset, plus call detail page with chat-format transcript and inline tool execution badges.

## What Was Built

- `src/lib/calls/timeline.ts`: Pure `buildTimeline(turns, actionLogs, callStartedAt)` function. Exports TurnItem, ToolItem, TranscriptItem discriminated union. Filters turns to user/assistant only (secondsFromStart ?? 0 guard). Maps action_logs to ToolItem with offset from (created_at - callStartedAt) / 1000. Returns sorted by offset ascending.

- `src/app/(dashboard)/calls/[callId]/page.tsx`: Server component fetching call by id (notFound() guard), action_logs by vapi_call_id, calls buildTimeline, renders CallDetailHeader + CallTranscript. Handles null started_at gracefully (empty timeline).

- `src/components/calls/call-transcript.tsx`: 'use client'. Renders each TranscriptItem by kind discriminant. User turns: right-aligned dark bubbles. Assistant turns: left-aligned muted bubbles. Tool items: centered badge with toolName, CheckCircle (success, emerald) or XCircle (error red, timeout yellow), executionMs, optional error detail in italic.

- `src/components/calls/call-detail-header.tsx`: Card component showing date, duration m:ss, cost $X.XXXXXX, call type label, ended_reason badge, customer phone. Summary section when available. Back to Calls link at page top.

## Commits

- `d042a78` — feat(03-05): add buildTimeline utility, call detail page, transcript, and header components

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/lib/calls/timeline.ts: FOUND
- src/app/(dashboard)/calls/[callId]/page.tsx: FOUND
- src/components/calls/call-transcript.tsx: FOUND
- src/components/calls/call-detail-header.tsx: FOUND
- buildTimeline export: FOUND
- TranscriptItem export: FOUND
- secondsFromStart ?? 0: FOUND
- notFound(): FOUND
- action_logs join on vapi_call_id: FOUND
