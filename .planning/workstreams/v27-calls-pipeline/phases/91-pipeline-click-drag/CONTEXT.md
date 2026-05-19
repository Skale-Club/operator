# Phase 91: Pipeline Click vs Drag - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Pre-implemented (merged from claude branch before v2.7 milestone creation)

<domain>
Fixes the pipeline kanban so a quick tap on a card opens a detail dialog (OpportunityDetailSheet) rather than accidentally triggering a drag. The card body receives `role="button"` + `onClick` + keyboard support. OpportunityDetailSheet is a Dialog with Info/Activity/Notes tabs, view and edit modes, contact combobox, tag picker, and custom fields.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices already made — phase was built prior to milestone formalization.

- DnD PointerSensor uses `{ distance: 6 }` activation constraint so fast taps don't register as drags
- Card outer div has `role="button"`, `tabIndex={0}`, `onClick={onOpen}`, and keyboard handler for Enter/Space
- Dropdown menu buttons use `onPointerDown={e.stopPropagation()}` + `onClick={e.stopPropagation()}` to prevent card click
- OpportunityDetailSheet is implemented as a shadcn Dialog (not Sheet, despite name) with VisuallyHidden DialogTitle
- Detail sheet loads opportunity, activities, tags, and all available tags in a single parallel Promise.all
- Edit mode: title, value, stage (Select), status (Select), expected_close_date (Input), contact combobox with debounced search, tag picker, custom fields form
- `updateOpportunity` called on save; `deleteOpportunity` with router.refresh on delete
</decisions>

<specifics>
Key files implementing this phase:
- `src/components/pipeline/opportunity-card.tsx` — role=button, onClick=onOpen, keyboard handler, stopPropagation on dropdown
- `src/components/pipeline/opportunity-detail-sheet.tsx` — Dialog with Info/Activity/Notes tabs, view+edit mode, tag picker, custom fields
- `src/components/pipeline/kanban-board.tsx` — passes onOpen handler, imports OpportunityDetailSheet, PointerSensor with distance:6
</specifics>

<deferred>
None
</deferred>
