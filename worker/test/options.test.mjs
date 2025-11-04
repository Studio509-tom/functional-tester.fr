import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptions } from '../src/runner.js';

test('normalizeOptions sets sensible defaults', () => {
  const cfg = normalizeOptions({});
  assert.equal(cfg.viewport.width, 1920);
  assert.equal(cfg.viewport.height, 1080);
  assert.equal(cfg.dsf, 2);
  assert.equal(cfg.screenshotFullPage, false);
  assert.equal(cfg.retries, 0);
});

test('normalizeOptions honors provided values', () => {
  const cfg = normalizeOptions({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, screenshotFullPage: true, retries: 2 });
  assert.equal(cfg.viewport.width, 1366);
  assert.equal(cfg.viewport.height, 768);
  assert.equal(cfg.dsf, 1);
  assert.equal(cfg.screenshotFullPage, true);
  assert.equal(cfg.retries, 2);
});
