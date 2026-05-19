---
plan: 91-01
status: complete
completed_at: "2026-05-19"
requirements_satisfied: [PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06]
---

# Summary: 91-01 — Pipeline Click vs Drag

## What was done

Pre-implemented click-vs-drag separation and OpportunityDetailSheet for the pipeline kanban. The `OpportunityCard` outer div has `role="button"`, `tabIndex={0}`, `onClick={() => onOpen(id)}`, and a keyboard handler for Enter/Space. The DnD `PointerSensor` uses `{ distance: 6 }` activation so short taps do not trigger drag. Dropdown menu buttons use `onPointerDown={e.stopPropagation()} onClick={e.stopPropagation()}` to prevent the card click from firing when using the context menu.

`OpportunityDetailSheet` is implemented as a shadcn `Dialog` (named "Sheet" but using Dialog primitive with VisuallyHidden title for a11y). On open it parallel-fetches opportunity, activities, all tags, and the opportunity's tag IDs. The Info tab shows view mode with all fields plus a contact link and tag badges; edit mode exposes title, value, stage (Select), status (Select), expected_close_date, contact combobox with debounced search, tag picker, and custom fields form. The Activity tab shows an activity feed. The Notes tab has a textarea for quick note creation. `updateOpportunity` is called on save; `deleteOpportunity` with router.refresh on delete.

## Key files

- `src/components/pipeline/opportunity-card.tsx` — role=button, onClick, keyboard support, dropdown stopPropagation
- `src/components/pipeline/opportunity-detail-sheet.tsx` — Dialog with Info/Activity/Notes tabs, view+edit mode, tag picker, custom fields
- `src/components/pipeline/kanban-board.tsx` — PointerSensor distance:6, onOpen handler, OpportunityDetailSheet rendered

## Deviations from Plan

None - implementation pre-existed and was confirmed correct.
