import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';
import { _test } from '../lib/analysis/fii-modal-contract.js';

const page = (ticker, value) => `<html><body>
<h2>INFORMAÇÕES SOBRE VALOR PATRIMONIAL</h2>
<div>VALOR PATRIMONIAL POR COTA R$ 100,00</div>
<div>VALOR DA COTA R$ 95,00</div>
<div>NÚMERO DE COTAS 10.000.000</div>
<div>P/VP 0,95</div>
<div>VALOR PATRIMONIAL ${value}</div>
<h2>INFORMAÇÕES SOBRE ${ticker}</h2><div>Valor patrimonial ${value}</div><h2>HISTÓRICO</h2>
</body></html>`;

const parsed = _test.fiiPeerPatrimonialValueFromHtml(page('HGLG11', 'R$ 5,20 Bilhões'), 'HGLG11');
assert.equal(parsed.value, 5_200_000_000);
assert.equal(parsed.valueDisplay, 'R$ 5,20 Bilhões');

clearCache();
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;
global.fetch = async url => {
  const ticker = String(url).match(/\/fiis\/([a-z0-9]+)\//i)?.[1]?.toUpperCase();
  if (ticker === 'XPML11') return new Response(page(ticker, 'R$ 6,10 Bilhões'), { status: 200, headers: { 'Content-Type': 'text/html' } });
  if (ticker === 'KNRI11') return new Response(page(ticker, 'R$ 4,30 Bilhões'), { status: 200, headers: { 'Content-Type': 'text/html' } });
  return new Response('', { status: 404 });
};
try {
  const input = {
    status: 'OK',
    rows: [
      { ticker: 'HGLG11', isReference: true, pvp: 0.92, patrimonialValue: null, patrimonialValueDisplay: '—' },
      { ticker: 'XPML11', isReference: false, pvp: 0.94, patrimonialValue: null, patrimonialValueDisplay: '—' },
      { ticker: 'KNRI11', isReference: false, pvp: 0.89, patrimonialValue: null, patrimonialValueDisplay: '—' }
    ],
    diagnostics: { mode: 'related_fiis_real_source' }
  };
  const enriched = await _test.enrichFiiPeerComparisonPatrimonialValues(input, {
    referenceTicker: 'HGLG11',
    referenceHtml: page('HGLG11', 'R$ 5,20 Bilhões'),
    timeoutMs: 1200,
    maxRemoteRows: 10,
    concurrency: 2
  });
  assert.equal(enriched.rows.find(row => row.ticker === 'HGLG11')?.patrimonialValue, 5_200_000_000);
  assert.equal(enriched.rows.find(row => row.ticker === 'XPML11')?.patrimonialValue, 6_100_000_000);
  assert.equal(enriched.rows.find(row => row.ticker === 'KNRI11')?.patrimonialValue, 4_300_000_000);
  assert.equal(enriched.diagnostics.patrimonialEnrichment.enriched, 3);
  assert.equal(enriched.diagnostics.patrimonialEnrichment.policy, 'individual_investidor10_fii_pages_no_inference_no_mock');
} finally {
  global.fetch = originalFetch;
  clearCache();
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
console.log('fii-modal-peer-patrimonial-enrichment-v325 ok');
