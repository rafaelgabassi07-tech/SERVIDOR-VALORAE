import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';
import { VALORAE_ANALYSIS_TICKER_ORDER } from '../lib/market/indices.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.11.03');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.11.03');
assert.equal(evaluateApkCompatibility('2026.08.11.03').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.09.07').status, 'SUPPORTED');
assert.equal(evaluateApkCompatibility('2026.08.11.04', { allowFuture: false }).reject, true);
assert.deepEqual(VALORAE_ANALYSIS_TICKER_ORDER, ['USD','IFIX','IDIV','SMLL','CDI','IPCA','IBOV','IVVB11']);

const indicesSource = fs.readFileSync(new URL('../lib/market/indices.js', import.meta.url), 'utf8');
for (const [code, symbol] of Object.entries({ USD:'BRL=X', IFIX:'IFIX.SA', IDIV:'IDIV.SA', SMLL:'SMLL.SA', IBOV:'^BVSP', IVVB11:'IVVB11.SA' })) {
  assert.ok(indicesSource.includes(`${code}: '${symbol}'`), `${code} deve manter símbolo real configurado`);
}
assert.match(indicesSource, /indices:\s*rows/);
assert.match(indicesSource, /tickerItems/);
assert.match(indicesSource, /items:\s*tickerItems/);
assert.ok(fs.existsSync(new URL('../docs/RELATORIO_COMPATIBILIDADE_APK_V645.md', import.meta.url)));
console.log('apk-v645-analysis-performance-visual-compatibility: ok');
