import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isB3RegularPortfolioSessionTimestamp } from '../lib/portfolio/history.js';

const saoPauloEpoch = (isoUtc) => Math.floor(new Date(isoUtc).getTime() / 1000);

// Agosto/2026: São Paulo = UTC-3.
assert.equal(isB3RegularPortfolioSessionTimestamp(saoPauloEpoch('2026-08-11T12:59:00Z')), false, '09:59 BRT é pré-pregão');
assert.equal(isB3RegularPortfolioSessionTimestamp(saoPauloEpoch('2026-08-11T13:00:00Z')), true, '10:00 BRT inicia pregão');
assert.equal(isB3RegularPortfolioSessionTimestamp(saoPauloEpoch('2026-08-11T19:55:00Z')), true, '16:55 BRT segue no pregão/call');
assert.equal(isB3RegularPortfolioSessionTimestamp(saoPauloEpoch('2026-08-11T20:00:00Z')), true, '17:00 BRT é limite do fechamento');
assert.equal(isB3RegularPortfolioSessionTimestamp(saoPauloEpoch('2026-08-11T20:01:00Z')), false, '17:01 BRT não entra no gráfico');
assert.equal(isB3RegularPortfolioSessionTimestamp(saoPauloEpoch('2026-08-11T20:30:00Z')), false, '17:30 BRT é after-market e deve ser excluído');
assert.equal(isB3RegularPortfolioSessionTimestamp(saoPauloEpoch('2026-08-15T16:00:00Z')), false, 'sábado não é pregão');

const source = fs.readFileSync(new URL('../lib/portfolio/history.js', import.meta.url), 'utf8');
assert.match(source, /filterB3RegularPortfolioSession\(series, \{ range, interval \}\)/);
assert.match(source, /if \(intraday && !isB3RegularPortfolioSessionTimestamp\(nowSeconds\)\) return regularSeries/);
assert.match(source, /series = filterB3RegularPortfolioSession\(series, \{ range, interval \}\);/);

console.log('portfolio-price-regular-session-v655: ok');
