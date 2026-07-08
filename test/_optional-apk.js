import assert from 'node:assert/strict';
import fs from 'node:fs';
import pathModule from 'node:path';

function readSiblingKotlinFamily(path, prefix) {
  const dir = pathModule.dirname(path);
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter(name => name.startsWith(prefix) && name.endsWith('.kt'))
    .sort()
    .map(name => fs.readFileSync(pathModule.join(dir, name), 'utf8'))
    .join('\n');
}

export function readOptionalApkFile(path) {
  if (fs.existsSync(path)) {
    if (path.endsWith('/AnalysisScreen.kt')) return readSiblingKotlinFamily(path, 'Analysis');
    if (path.endsWith('/PortfolioScreen.kt')) return readSiblingKotlinFamily(path, 'Portfolio');
    return fs.readFileSync(path, 'utf8');
  }
  if (path.endsWith('/AnalysisScreen.kt')) return readSiblingKotlinFamily(path, 'Analysis');
  if (path.endsWith('/PortfolioScreen.kt')) return readSiblingKotlinFamily(path, 'Portfolio');
  return '';
}

export function assertOptionalMatch(text, pattern, message) {
  if (!text) return;
  assert.match(text, pattern, message);
}

export function assertOptionalDoesNotMatch(text, pattern, message) {
  if (!text) return;
  assert.doesNotMatch(text, pattern, message);
}
