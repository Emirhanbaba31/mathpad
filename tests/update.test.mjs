import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newer, VERSION } from '../js/update.js';

test('newer compares versions numerically', () => {
  assert.equal(newer('v1.10.0', '1.9.2'), true);
  assert.equal(newer('1.8.1', '1.8.1'), false);
  assert.equal(newer('1.8.0', 'v1.8.1'), false);
  assert.equal(newer('2.0', '1.99.99'), true);
});

test('app VERSION matches package.json', () => {
  assert.equal(VERSION, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);
});
