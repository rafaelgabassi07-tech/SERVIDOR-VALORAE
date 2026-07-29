import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../lib/sources/quotes.js', import.meta.url), 'utf8');
assert.match(source, /analysisDiscoveryMode\s*=\s*requestMode\s*===\s*'analysis_discovery_full'/);
assert.match(source, /const includeFundamentals = analysisDiscoveryMode\s*\? true/s);
assert.match(source, /fundamentalsProvider:\s*'Fundamentus batch snapshot'/);
assert.match(source, /includes:\s*\['cotacao', 'variacaoDia', 'pvp', 'dy', 'liquidezMediaDiaria'\]/);
console.log('analysis fundamentals regression v397 OK');
