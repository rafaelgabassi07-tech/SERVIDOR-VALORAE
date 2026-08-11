import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';
import { VALORAE_ANALYSIS_TICKER_ORDER } from '../lib/market/indices.js';

assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.11.01');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.11.01');
assert.equal(evaluateApkCompatibility('2026.08.11.01').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.09.03').status, 'SUPPORTED');
assert.deepEqual(VALORAE_ANALYSIS_TICKER_ORDER, ['USD','IFIX','IDIV','SMLL','CDI','IPCA','IBOV','IVVB11']);

const source = fs.readFileSync(new URL('../lib/market/indices.js', import.meta.url), 'utf8');
for (const [code, symbol] of Object.entries({ USD:'BRL=X', IFIX:'IFIX.SA', IDIV:'IDIV.SA', SMLL:'SMLL.SA', IBOV:'^BVSP', IVVB11:'IVVB11.SA' })) {
  assert.ok(source.includes(`${code}: '${symbol}'`), `${code} deve possuir símbolo configurado`);
}
assert.match(source, /ANALYSIS_TICKER_MACRO_CODES = new Set\(\['CDI', 'IPCA'\]\)/);
assert.match(source, /ok:\s*value != null/, 'CDI/IPCA só podem ficar OK com valor numérico disponível');
assert.match(source, /VALORAE_ANALYSIS_TICKER_ORDER\.map\(code => rows\.find/);
assert.match(source, /tickerItems\.length !== VALORAE_ANALYSIS_TICKER_ORDER\.length/);
console.log('apk-v641-analysis-ticker-contract: ok');
