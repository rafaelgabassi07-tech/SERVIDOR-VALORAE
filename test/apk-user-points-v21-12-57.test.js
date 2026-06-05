import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const yahoo = read('lib/market/yahoo.js');
const history = read('routes/asset/history.js');
const rankings = read('lib/market/rankings-i10.js');
const dividends = read('routes/portfolio/dividends.js');
const nextDividends = read('routes/portfolio/next-dividends.js');
const pkg = JSON.parse(read('package.json'));

assert.equal(pkg.valorae.releasePatch, '21.12.59-valorae-i10-rankings-complete');
assert.match(yahoo, /IFIX_PROXY/);
assert.match(yahoo, /XFIX11\.SA/);
assert.match(history, /normalizeHistoryTicker/);
assert.match(history, /isIndexAlias/);
assert.match(rankings, /fiis/);
assert.match(rankings, /priceDisplay/);
assert.match(rankings, /changeDisplay/);
assert.match(rankings, /changePercent/);
assert.match(dividends, /positions/);
assert.match(dividends, /historyEvents|historico/);
assert.match(dividends, /events/);
assert.match(nextDividends, /upcomingEvents/);
assert.match(nextDividends, /historyEvents/);
assert.match(nextDividends, /nextDividend/);
assert.doesNotMatch(nextDividends, /root error/i);
console.log('apk-user-points-v21-12-59 OK');
