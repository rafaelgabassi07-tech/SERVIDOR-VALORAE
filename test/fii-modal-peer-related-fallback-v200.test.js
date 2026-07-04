import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

const staticInvestidor10Html = `
  <h2>COMPARANDO COM OUTROS FIIS</h2>
  <p>Mesmo tipo e segmento Mesmo tipo Mesmo segmento Todos</p>
  <p>ARRASTE O QUADRO PARA VER MAIS DADOS Dividend YIELD P/VP VALOR PATRIMONIAL TIPO SEGMENTO</p>
  <h2>Checklist do investidor buy and hold sobre GGRC11</h2>
  <h2>FIIs Relacionadas</h2>
  <h2>FIIB11</h2><h3>FUNDO DE INVESTIMENTO IMOBILIARIO INDUST...</h3><p>DY: 8,75%</p><p>P/VP: 0,74</p>
  <h2>HGLG11</h2><h3>CSHG LOGÍSTICA - FUNDO DE INVESTIMENTO I...</h3><p>DY: 8,82%</p><p>P/VP: 0,90</p>
  <h2>LVBI11</h2><h3>FUNDO DE INVESTIMENTO IMOBILIÁRIO VBI LO...</h3><p>DY: 8,67%</p><p>P/VP: 0,86</p>
  <h2>BTLG11</h2><h3>BTG PACTUAL LOGÍSTICA FUNDO DE INVESTIME...</h3><p>DY: 9,30%</p><p>P/VP: 1,00</p>
  <h5>Comparar Fiis</h5>
`;

const direct = _test.extractInvestidor10FiiPeerComparison(staticInvestidor10Html, 'GGRC11');
assert.equal(direct.status, 'EMPTY', 'Quando a tabela renderizada do comparador não vem na fonte capturada, o contrato não reconstrói por FIIs relacionados.');
assert.equal(direct.diagnostics.mode, 'rendered_table');
assert.equal(direct.diagnostics.parsedRows, 0);
assert.equal(_test.extractInvestidor10FiiRelatedPeers, undefined);
assert.equal(_test.buildReferenceFiiPeerRow, undefined);

console.log('fii-modal-peer-related-fallback-v200 no-static-substitution ok');
