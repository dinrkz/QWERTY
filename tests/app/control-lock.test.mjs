import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createControlLock } from '../../public/control-lock.mjs';

test('completion restores interactive controls after AI readiness changes, preserving pre-disabled controls', () => {
  const controls = [{ disabled: false }, { disabled: false }, { disabled: true }];
  const lock = createControlLock(() => controls);
  let ready = true;
  const pending = value => { if (!value || ready) lock(value); };
  pending(true);
  assert.ok(controls.every(c => c.disabled));
  pending(true); // Duplicate refresh must not replace the original states.
  ready = false; // A refreshed budget is blocked/exhausted before completion.
  pending(false);
  assert.deepEqual(controls.map(c => c.disabled), [false, false, true]);
  pending(true); pending(false); // Local search remains usable without an AI lock.
  assert.deepEqual(controls.map(c => c.disabled), [false, false, true]);
});
