import assert from 'node:assert/strict';
import fs from 'node:fs';

const analysis = fs.readFileSync(new URL('../lib/portfolio/analysis.js', import.meta.url), 'utf8');
const sources = fs.readFileSync(new URL('../lib/sources/asset-details.js', import.meta.url), 'utf8');
const cdi = fs.readFileSync(new URL('../lib/sources/cdi.js', import.meta.url), 'utf8');

assert.match(analysis, /function returnRangeMonths\(range = 'SINCE_START', payload = \{\}\)/);
assert.match(analysis, /const transactions = normalizeTransactions\(payload\.transactions \|\| \[\]\)/);
assert.match(analysis, /Math\.min\(600, ageMonths\)/);
assert.match(analysis, /const displayMonths = returnRangeMonths\(range, payload\)/);
assert.match(analysis, /Math\.min\(600, Number\(payload\.benchmarkMonths \|\| displayMonths\)/);
assert.doesNotMatch(analysis, /return 120;\s*\n\}/);
assert.doesNotMatch(analysis, /Math\.min\(120, Number\.isFinite\(requestedMonths\)/);
assert.match(sources, /'MAX': \{ range: 'max', interval: '1mo'.*limit: 600 \}/);
assert.match(cdi, /Math\.min\(600, Number\(months \|\| 12\)\)/);

console.log('portfolio-returns-since-start-v367 ok');
