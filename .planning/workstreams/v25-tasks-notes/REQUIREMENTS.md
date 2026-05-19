# Requirements: v2.5 Tasks & Notes CRM System

**Workstream:** v25-tasks-notes
**Created:** 2026-05-18
**Milestone:** v2.5

---

## TSK — Tasks System

Full CRM-grade task management, multi-tenant, linked to any entity.

- [ ] **TSK-01:** Admin/user can create a task with title, description (optional), due date (optional), priority (low/medium/high/urgent), status (todo/in_progress/done/cancelled), and assigned user (optional)
- [ ] **TSK-02:** Admin/user can edit any field on an existing task
- [ ] **TSK-03:** Admin/user can delete a task; deletion is permanent
- [ ] **TSK-04:** User can view all org tasks at `/dashboard/tasks` with columns: title, priority, status, due date, assigned user, linked entity
- [ ] **TSK-05:** User can filter the task list by status, priority, assigned user, and due date range
- [ ] **TSK-06:** User can sort the task list by due date, priority, status, or creation date
- [ ] **TSK-07:** Tasks past their due date with status todo/in_progress show a visual overdue indicator (red badge or strikethrough date)
- [ ] **TSK-08:** User can quick-create a task from the task list page without navigating away (slide-over or inline form)
- [x] **TSK-09:** A task can be linked to a contact, account, or opportunity (or none) via `entity_type` + `entity_id` polymorphic association
- [ ] **TSK-10:** Clicking "Mark done" in the task list toggles status to `done` without a full-page reload
- [ ] **TSK-11:** Tasks section appears in the detail page of every linked entity (contact, account, opportunity) showing tasks associated with that record
- [x] **TSK-12:** All task reads/writes are scoped by `org_id` via RLS — tasks from one org are invisible to another
- [ ] **TSK-13:** `assigned_to` references `auth.users.id`; users see their own tasks highlighted or filterable by "My Tasks"
- [ ] **TSK-14:** Task list shows task count badge in sidebar navigation item

---

## NOT — Notes System

Structured notes with pin support and entity associations.

- [ ] **NOT-01:** Admin/user can create a note with optional title and body content (plain text, multi-line)
- [ ] **NOT-02:** Admin/user can edit the title and content of an existing note
- [ ] **NOT-03:** Admin/user can delete a note; deletion is permanent
- [ ] **NOT-04:** User can view all org notes at `/dashboard/notes` as a card grid or list
- [ ] **NOT-05:** User can pin important notes; pinned notes appear at the top of the list
- [ ] **NOT-06:** User can search notes by title or content (case-insensitive substring match)
- [ ] **NOT-07:** User can quick-create a note from the notes page (slide-over or inline form)
- [ ] **NOT-08:** A note can be linked to a contact, account, or opportunity (or none) via `entity_type` + `entity_id` polymorphic association
- [ ] **NOT-09:** Notes section appears in the detail page of every linked entity (contact, account, opportunity) showing notes associated with that record
- [ ] **NOT-10:** Note cards show title (or first line of content as fallback), creation date, author name, and linked entity label
- [ ] **NOT-11:** All note reads/writes are scoped by `org_id` via RLS — notes from one org are invisible to another
- [ ] **NOT-12:** `created_by` references `auth.users.id` and is displayed as author on the card

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| TSK-01..14 | 77, 78, 81 | ○ |
| NOT-01..12 | 79, 80, 81 | ○ |
| DB schema (tasks 067) | 76-01 | ✅ |
