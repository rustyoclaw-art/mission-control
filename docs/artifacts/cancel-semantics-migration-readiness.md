# Cancel-Semantics Compatibility Patch — Migration Readiness Report

**Date:** 2026-03-15
**Patch:** Option 1 — Cancel-Semantics Compatibility Layer
**Commit:** `786932d`
**Model:** `claude-sonnet-4-6`

---

## Readiness Verdict: **GO**

All gates passed. The patch is safe to deploy to the live stack.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/types.ts` | Added `'cancelled'` to `TaskStatus` union; added `cancelled: number` to `WorkspaceStats.taskCounts` |
| `src/lib/validation.ts` | Added `'cancelled'` to Zod `TaskStatus` enum so PATCH accepts it |
| `src/lib/db/schema.ts` | Updated `tasks` CHECK constraint for fresh databases |
| `src/lib/db/migrations.ts` | Added migration `015` — recreates `tasks` table with updated CHECK constraint; data-safe (FK off, INSERT…SELECT, DROP, RENAME, reindex) |
| `src/lib/task-governance.ts` | Added `TERMINAL_STATUSES` constant; exported `isCancellable(status)` helper |
| `src/app/api/tasks/[id]/route.ts` | Cancel fast-path in PATCH: guard → clear planning → reset agent → log event → broadcast → learner notify → early return |
| `src/app/api/workspaces/route.ts` | Initialised `cancelled: 0` in `WorkspaceStats` taskCounts builder |
| `src/lib/task-governance.test.ts` | 6 new cancel semantics tests |

---

## Test Outcomes

```
Tests:  10/10 pass  (4 pre-existing + 6 new cancel semantics)
Fail:   0
Build:  ✓ clean (zero type errors; pre-existing <img> warning unrelated)
```

### New tests

| # | Test | Result |
|---|---|---|
| 5 | `isCancellable` true for all non-terminal statuses | PASS |
| 6 | `isCancellable` false for `done` and `cancelled` | PASS |
| 7 | Task DB row accepts `status='cancelled'` after migration 015 | PASS |
| 8 | Cancelled task persists and is queryable | PASS |
| 9 | Double-cancel blocked by `isCancellable` | PASS |
| 10 | Cancel of done task blocked by `isCancellable` | PASS |

---

## Smoke Test Checklist (manual — run against live stack before cutover)

### Status / Health
- [ ] `GET /api/openclaw/status` → 200
- [ ] `GET /api/workspaces?stats=true` → includes `cancelled: 0` in taskCounts

### Create / Update / Dispatch / Cancel
- [ ] `POST /api/tasks` → creates task with `status=inbox`
- [ ] `PATCH /api/tasks/:id` `{status:"assigned", assigned_agent_id:"..."}` → auto-dispatch fires
- [ ] `PATCH /api/tasks/:id` `{status:"cancelled"}` from `inbox` → returns task with `status=cancelled`, agent reset to `standby`
- [ ] `PATCH /api/tasks/:id` `{status:"cancelled"}` from `in_progress` → same, planning cleared
- [ ] `PATCH /api/tasks/:id` `{status:"cancelled"}` from `done` → 400 `already terminal`
- [ ] `PATCH /api/tasks/:id` `{status:"cancelled"}` from `cancelled` → 400 `already terminal`

### Agent Status Update
- [ ] After cancel of sole active task: `GET /api/agents/:id` → `status=standby`
- [ ] After cancel with other active tasks: agent remains `working`

### Telemetry / SSE Visibility
- [ ] SSE stream (`GET /api/events/stream`) emits `task_updated` on cancel
- [ ] `GET /api/events` shows `task_status_changed` event for the cancel
- [ ] `GET /api/workspaces?stats=true` increments `cancelled` count after cancel

---

## Cancel Semantics Contract

```
PATCH /api/tasks/:id
{ "status": "cancelled" }

→ 200  task object with status="cancelled"   (from any non-terminal status)
→ 400  "already terminal"                    (from done or cancelled)
```

**Side-effects on cancel:**
- `planning_session_key`, `planning_messages`, `planning_complete`, `planning_dispatch_error` all cleared
- Assigned agent reset to `standby` if this was their only active task
- `task_status_changed` event logged
- SSE `task_updated` broadcast
- Learner notified (non-blocking)
- No dispatch, no evidence gate, no status_reason required

**`cancelled` is terminal** — no transitions out of it (use `DELETE` to remove).

---

## Rollback Notes

The patch is additive and reversible:

1. **Application rollback** (revert commit `786932d`): removes `cancelled` from Zod + type system; the DB column CHECK still allows it but the app will reject it via validation — no data corruption risk.

2. **Database rollback** (if needed): run a manual migration to recreate the `tasks` table without `cancelled` in the CHECK constraint — only safe if no rows have `status='cancelled'`.  Use `SELECT COUNT(*) FROM tasks WHERE status='cancelled'` before deciding.

3. **Migration 015 is idempotent-safe** — the migration runner skips already-applied IDs, so re-running on an up-to-date DB is a no-op.

---

## Constraints Observed

- `/opt/homebrew/lib/node_modules/openclaw` — not modified
- Live stack — not touched; changes are confined to the working directory
- No existing migrations removed or reordered
- No breaking changes to existing status values or API contracts
