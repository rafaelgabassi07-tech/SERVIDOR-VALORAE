import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

const staticInvestidor10Html = `
  <h2>COMPARANDO COM OUTROS FIIS</h2>
  <p>Mesmo tipo e segmento Mesmo tipo Mesmo segmento Todos</p>
  <p>ARRASTE O QUADRO PARA VER MAIS DADOS Dividend YIELD P/VP VALOR PATRIMONIAL TIPO SEGMENTO</p>
  <h2>Checklist do investidor buy and hold sobre GGRC11</h2>
  <h2>Média do Tipo e Segmento</h2>
  <p>Mesmo tipo e segmento Mesmo tipo Mesmo segmento Todos</p>
  <p>Comparando o GGRC11 com a média dos indicadores dos FIIs de tipo (Fundo de Tijolo) e do segmento (Logístico / Indústria / Galpões).</p>
  <h2>FIIs Relacionadas</h2>
  <h2>FIIB11</h2><h3>FUNDO DE INVESTIMENTO IMOBILIARIO INDUST...</h3><p>DY: 8,75%</p><p>P/VP: 0,74</p>
  <h2>HGLG11</h2><h3>CSHG LOGÍSTICA - FUNDO DE INVESTIMENTO I...</h3><p>DY: 8,82%</p><p>P/VP: 0,90</p>
  <h2>LVBI11</h2><h3>FUNDO DE INVESTIMENTO IMOBILIÁRIO VBI LO...</h3><p>DY: 8,67%</p><p>P/VP: 0,86</p>
  <h2>BTLG11</h2><h3>BTG PACTUAL LOGÍSTICA FUNDO DE INVESTIME...</h3><p>DY: 9,30%</p><p>P/VP: 1,00</p>
  <h5>Comparar Fiis</h5>
`;

const direct = _test.extractInvestidor10FiiPeerComparison(staticInvestidor10Html, 'GGRC11', {
  dy12mDisplay: '12,38%',
  dy12m: 12.38,
  pvpDisplay: '0,88',
  pvp: 0.88
});
assert.equal(direct.status, 'OK', 'Quando a tabela renderizada do comparador não vem na fonte capturada, o contrato usa FIIs Relacionados reais do próprio Investidor10.');
assert.equal(direct.diagnostics.mode, 'related_fiis_real_source');
assert.equal(direct.diagnostics.parsedRows, 5);
assert.deepEqual(direct.rows.map(row => row.ticker), ['GGRC11', 'FIIB11', 'HGLG11', 'LVBI11', 'BTLG11']);
assert.equal(direct.rows[0].isReference, true);
assert.equal(direct.rows.find(row => row.ticker === 'FIIB11').pvpDisplay, '0,74');
assert.equal(direct.rows.find(row => row.ticker === 'BTLG11').dividendYieldDisplay, '9,30%');
assert.equal(direct.rows.find(row => row.ticker === 'HGLG11').fundType, '—', 'FII relacionado não herda o tipo do fundo de referência');
assert.equal(direct.rows.find(row => row.ticker === 'LVBI11').segment, '—', 'FII relacionado não herda o segmento do fundo de referência');
assert.equal(direct.rows.find(row => row.ticker === 'FIIB11').patrimonialValueDisplay, '—');
assert.ok(direct.diagnostics.policy.includes('no_static_substitution_no_mock'));

console.log('fii-modal-peer-related-fallback-v200 real-source fallback ok');
