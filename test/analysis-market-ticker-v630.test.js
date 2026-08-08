import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../lib/market/indices.js', import.meta.url), 'utf8');
assert.match(source, /USD:\s*'BRL=X'/, 'USD deve usar cotação real BRL=X');
assert.match(source, /getCdiAccumulatedSeries\(12,\s*5200\)/, 'CDI deve reutilizar fonte oficial BCB');
assert.match(source, /getIpcaSeries\(12\)/, 'IPCA deve reutilizar a mesma série oficial/fallback real do comparador');
assert.match(source, /\['USD', 'IFIX', 'IDIV', 'SMLL', 'CDI', 'IPCA', 'IBOV', 'IVVB11'\]/, 'ordem do ticker deve ser estável');
assert.match(source, /tickerItems/, 'payload deve expor tickerItems sem remover indices legados');
assert.match(source, /indices:\s*rows/, 'contrato legado indices deve continuar presente');
assert.match(source, /fetchInvestidor10DirectIndexHistory/, 'índices B3 devem compartilhar contingência real com o comparador');
assert.match(source, /COMPARISON_DIRECT_INDEXES/, 'paridade de fonte deve cobrir IBOV, IFIX, IDIV e SMLL');
assert.match(source, /Sem valores sintéticos/, 'ticker não pode fabricar dados');
console.log('analysis market ticker v630 static contract OK');
