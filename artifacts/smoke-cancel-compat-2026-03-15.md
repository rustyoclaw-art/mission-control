# Smoke Test — Cancel Semantics Compatibility

Date: 2026-03-15
Base URL: http://localhost:4100

## Results

- `GET /api/openclaw/status` → **200 OK** (payload keys: `connected`, `gateway_url`, `sessions`)
- `POST /api/tasks` (create) → **201 Created**
- `PATCH /api/tasks/:id` to `assigned` with `assigned_agent_id` → **200 OK** (`status=assigned`)
- `PATCH /api/tasks/:id` to `cancelled` → **200 OK** (`status=cancelled`)
- second `PATCH /api/tasks/:id` to `cancelled` → **400** (`already terminal` semantics)
- `GET /api/agents/:id` after cancel → **agent status `standby`**
- `GET /api/events?limit=50` contains `task_status_changed` event message: `Task "Smoke Cancel Compat" cancelled`
- `GET /api/workspaces?stats=true` returns `taskCounts.cancelled` field for workspace stats schema

Cleanup:
- `DELETE /api/tasks/:id` → **200 OK** (`{"success":true}`)

## Notes

- This smoke validates cancel lifecycle compatibility and non-breaking behavior for callers expecting `status=cancelled`.
- Dispatch path was exercised through assign→assigned before cancellation.
