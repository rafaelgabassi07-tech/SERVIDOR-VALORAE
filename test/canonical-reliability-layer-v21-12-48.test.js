import assert from 'node:assert/strict';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';
import { applyCanonicalReliabilityLayer, canonicalReliabilityCapabilities } from '../lib/canonical/cvm-reliability-layer.js';

const originalFetch = globalThis.fetch;
const originalEnv = process.env.VALORAE_CANONICAL_REGISTRY_JSON;

function weakHtml() {
  return `<!doctype html><html><body>
    <h1>PETR4 Petrobras PN</h1>
    <section>Cotação R$ 32,45 Variação 1,25%</section>
  </body></html>`;
}

try {
  clearValoraeCaches('all');
  process.env.VALORAE_CANONICAL_REGISTRY_JSON = JSON.stringify({
    PETR4: {
      issuerKey: 'PETR',
      displayName: 'Petrobras Teste Canônico',
      companyName: 'Petróleo Brasileiro S.A. - Petrobras',
      assetClass: 'ACAO',
      sectorHint: 'Petróleo, Gás e Biocombustíveis',
      market: 'B3',
      country: 'BR',
    }
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('investidor10.com.br')) return new Response(weakHtml(), { status: 200, headers: { 'content-type': 'text/html' } });
    if (u.includes('statusinvest.com.br')) return new Response('', { status: 503, headers: { 'content-type': 'text/html' } });
    if (u.includes('finance.yahoo.com')) return new Response(JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 32.45, previousClose: 32.05, chartPreviousClose: 32.05 } }] } }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ chart: { result: [] } }), { status: 404, headers: { 'content-type': 'application/json' } });
  };

  const direct = applyCanonicalReliabilityLayer('PETR4', 'ACAO', { precoAtual: 32.45, nome: 'Nome Vivo' });
  assert.equal(direct.results.nome, 'Nome Vivo', 'camada canônica não deve sobrescrever dados vivos do Investidor10/StatusInvest');
  assert.equal(direct.results.empresa, 'Petróleo Brasileiro S.A. - Petrobras');
  assert.equal(direct.reliability.providerStrategy.richProvidersPreserved, true);
  assert.equal(direct.reliability.blocks.identity.status, 'OK');

  const payload = await ValoraeEngine.fetchAtivo('PETR4', 'ACAO', {
    profile: 'fast',
    view: 'app',
    cache: false,
    useYahooFallback: true,
    statusInvestComplement: false,
    canonicalData: true,
  });

  assert.equal(payload.status, 'OK', 'payload renderizável por blocos não deve virar PARTIAL global quando há base canônica + quote mínima');
  assert.equal(payload.partial, false);
  assert.equal(payload.dataReliability.version, '21.12.52-news-reliability-upgrade');
  assert.equal(payload.dataReliability.providerStrategy.richProvidersPreserved, true);
  assert.ok(payload.dataReliability.blocks.identity.status === 'OK');
  assert.ok(['PARTIAL', 'OK'].includes(payload.dataReliability.blocks.quote.status));
  assert.match(payload.extractionCompleteness.canonicalReliability.version, /21\.12\.(48|49|50|51|52|54|55|56|57|58|59|69|70)/);
  assert.ok(payload.extractionCompleteness.canonicalReliability.used);
  assert.ok(payload.warnings.some(w => /Camada canônica CVM/.test(w)));

  const caps = canonicalReliabilityCapabilities();
  assert.equal(caps.policy, 'fill-missing-only-preserve-rich-live-data');
  assert.ok(caps.datasets.cadastralCompanies.includes('dados.cvm.gov.br'));
} finally {
  if (originalEnv === undefined) delete process.env.VALORAE_CANONICAL_REGISTRY_JSON;
  else process.env.VALORAE_CANONICAL_REGISTRY_JSON = originalEnv;
  globalThis.fetch = originalFetch;
  clearValoraeCaches('all');
}

console.log('canonical-reliability-layer-v21-12-48 OK');
