import test from 'node:test';
import assert from 'node:assert/strict';
import { run, queryOne } from './db';
import {
  hasStageEvidence,
  taskCanBeDone,
  ensureFixerExists,
  getFailureCountInStage,
  isCancellable,
} from './task-governance';

function seedTask(id: string, workspace = 'default') {
  run(
    `INSERT INTO tasks (id, title, status, priority, workspace_id, business_id, created_at, updated_at)
     VALUES (?, 'T', 'review', 'normal', ?, 'default', datetime('now'), datetime('now'))`,
    [id, workspace]
  );
}

test('evidence gate requires deliverable + activity', () => {
  const taskId = crypto.randomUUID();
  seedTask(taskId);

  assert.equal(hasStageEvidence(taskId), false);

  run(
    `INSERT INTO task_deliverables (id, task_id, deliverable_type, title, created_at)
     VALUES (lower(hex(randomblob(16))), ?, 'file', 'index.html', datetime('now'))`,
    [taskId]
  );
  assert.equal(hasStageEvidence(taskId), false);

  run(
    `INSERT INTO task_activities (id, task_id, activity_type, message, created_at)
     VALUES (lower(hex(randomblob(16))), ?, 'completed', 'did thing', datetime('now'))`,
    [taskId]
  );

  assert.equal(hasStageEvidence(taskId), true);
});

test('task cannot be done when status_reason indicates failure', () => {
  const taskId = crypto.randomUUID();
  seedTask(taskId);

  run(`UPDATE tasks SET status_reason = 'Validation failed: CSS broken' WHERE id = ?`, [taskId]);
  run(
    `INSERT INTO task_deliverables (id, task_id, deliverable_type, title, created_at)
     VALUES (lower(hex(randomblob(16))), ?, 'file', 'index.html', datetime('now'))`,
    [taskId]
  );
  run(
    `INSERT INTO task_activities (id, task_id, activity_type, message, created_at)
     VALUES (lower(hex(randomblob(16))), ?, 'completed', 'did thing', datetime('now'))`,
    [taskId]
  );

  assert.equal(taskCanBeDone(taskId), false);
});

test('ensureFixerExists creates fixer when missing', () => {
  const fixer = ensureFixerExists('default');
  assert.equal(fixer.created, true);

  const stored = queryOne<{ id: string; role: string }>('SELECT id, role FROM agents WHERE id = ?', [fixer.id]);
  assert.ok(stored);
  assert.equal(stored?.role, 'fixer');
});

test('failure counter reads status_changed failure events', () => {
  const taskId = crypto.randomUUID();
  seedTask(taskId);

  run(
    `INSERT INTO task_activities (id, task_id, activity_type, message, created_at)
     VALUES (lower(hex(randomblob(16))), ?, 'status_changed', 'Stage failed: verification → in_progress (reason: x)', datetime('now'))`,
    [taskId]
  );
  run(
    `INSERT INTO task_activities (id, task_id, activity_type, message, created_at)
     VALUES (lower(hex(randomblob(16))), ?, 'status_changed', 'Stage failed: verification → in_progress (reason: y)', datetime('now'))`,
    [taskId]
  );

  assert.equal(getFailureCountInStage(taskId, 'verification'), 2);
});

// --- Cancel semantics compatibility tests ---

test('isCancellable returns true for all non-terminal statuses', () => {
  const cancellable = ['pending_dispatch', 'planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'verification'];
  for (const s of cancellable) {
    assert.equal(isCancellable(s), true, `Expected ${s} to be cancellable`);
  }
});

test('isCancellable returns false for terminal statuses', () => {
  assert.equal(isCancellable('done'), false);
  assert.equal(isCancellable('cancelled'), false);
});

test('task can be set to cancelled status in the database', () => {
  const taskId = crypto.randomUUID();
  seedTask(taskId);

  // Should not throw — cancelled is now a valid status
  run(`UPDATE tasks SET status = 'cancelled' WHERE id = ?`, [taskId]);

  const task = queryOne<{ status: string }>('SELECT status FROM tasks WHERE id = ?', [taskId]);
  assert.equal(task?.status, 'cancelled');
});

test('cancelled task status persists and is queryable', () => {
  const taskId = crypto.randomUUID();
  run(
    `INSERT INTO tasks (id, title, status, priority, workspace_id, business_id, created_at, updated_at)
     VALUES (?, 'Cancel Test', 'cancelled', 'normal', 'default', 'default', datetime('now'), datetime('now'))`,
    [taskId]
  );

  const task = queryOne<{ status: string; id: string }>('SELECT id, status FROM tasks WHERE id = ?', [taskId]);
  assert.ok(task, 'Task should be found');
  assert.equal(task?.status, 'cancelled');
});

test('cancelling already-cancelled task is blocked by isCancellable', () => {
  // isCancellable guards the API layer against double-cancel
  assert.equal(isCancellable('cancelled'), false, 'Already cancelled task must not be re-cancelled');
});

test('cancelling done task is blocked by isCancellable', () => {
  assert.equal(isCancellable('done'), false, 'Done task must not be cancelled');
});
