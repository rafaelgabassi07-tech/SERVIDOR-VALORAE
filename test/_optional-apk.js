import assert from 'node:assert/strict';
import fs from 'node:fs';

export function readOptionalApkFile(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

export function assertOptionalMatch(text, pattern, message) {
  if (!text) return;
  assert.match(text, pattern, message);
}

export function assertOptionalDoesNotMatch(text, pattern, message) {
  if (!text) return;
  assert.doesNotMatch(text, pattern, message);
}
