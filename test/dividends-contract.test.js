import assert from 'node:assert/strict';
import { parseAgendaHtml } from '../lib/sources/agenda-dividends.js';
import { buildDividendsContract } from '../lib/portfolio/dividends-contract.js';

const compact = 'FISC11 R$ 0,62 20/07/2026 FATN11 R$ 0,80 21/07/2026';
const fisc = parseAgendaHtml(compact, ['FISC11']);
assert.equal(fisc.length, 1);
assert.equal(fisc[0].ticker, 'FISC11');
assert.equal(fisc[0].valuePerShare, 0.62);
assert.equal(fisc[0].paymentDate, '2026-07-20');
const fatn = parseAgendaHtml(compact, ['FATN11']);
assert.equal(fatn.length, 1);
assert.equal(fatn[0].ticker, 'FATN11');
assert.equal(fatn[0].valuePerShare, 0.8);
assert.equal(fatn[0].paymentDate, '2026-07-21');
assert.deepEqual(parseAgendaHtml(compact, []), []);

const empty = await buildDividendsContract({ positions: [], tickers: [], includeDividends: true });
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.officialEvents.length, 0);
assert.equal(empty.diagnostics[0].reason, 'emptyTickers');
