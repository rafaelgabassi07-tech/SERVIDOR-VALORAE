import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isCurrentInvestidor10PeerTable,
  parseCurrentInvestidor10PeerTable
} from '../lib/analysis/stock-peer-table.js';
import { looksLikeB3Ticker, normalizeTicker } from '../lib/core/tickers.js';

const petr4LiveShape = `
COMPARANDO PETR4 COM OUTRAS AÇÕES
Ativos Cotação (R$) Variação 12m DY P/L P/VP ROE Margem Líquida
PETR4 PETROLEO BRASILEIRO S.A. PETROBRAS R$ 41,97 49,13% 7,04% 4,06 1,12 27,73% 24,32%
PRIO3 PETRO RIO S.A R$ 58,69 51,11% 0,00% 13,24 1,81 13,71% 18,11%
VBBR3 VIBRA ENERGIA S.A. R$ 33,30 76,04% 4,64% 13,28 1,84 13,83% 1,56%
COMPARAÇÃO DETALHADA
`;
assert.equal(isCurrentInvestidor10PeerTable(petr4LiveShape), true);
const petrRows = parseCurrentInvestidor10PeerTable(petr4LiveShape);
assert.equal(petrRows.length, 3);
assert.deepEqual(petrRows[0], {
  ticker: 'PETR4', quoteDisplay: 'R$ 41,97', variation12mDisplay: '49,13%',
  dividendYieldDisplay: '7,04%', plDisplay: '4,06', pvpDisplay: '1,12',
  roeDisplay: '27,73%', marginLiquidDisplay: '24,32%'
});

const specialTickerShape = `
COMPARANDO QVQP3B COM OUTRAS AÇÕES
Ativos Cotação (R$) Variação 12m DY P/L P/VP ROE Margem Líquida
QVQP3B 524 PARTICIPAÇÕES S.A. R$ 0,28 -96,92% 0,00% -628,38 692,83 -110,26% 0,00%
G2DI33 G2D INVESTMENTS R$ 1,11 -36,21% 0,00% -1,17 0,21 -18,07% 121,85%
SPRT3B LONGDIS S.A. R$ 1,31 -98,29% 0,00% -46,59 -1,59 -3,42% 0,00%
`;
const specialRows = parseCurrentInvestidor10PeerTable(specialTickerShape);
assert.deepEqual(specialRows.map(row => row.ticker), ['QVQP3B', 'G2DI33', 'SPRT3B']);
assert.equal(looksLikeB3Ticker('QVQP3B'), true);
assert.equal(looksLikeB3Ticker('SPRT3B'), true);
assert.equal(looksLikeB3Ticker('G2DI33'), true);
assert.equal(normalizeTicker('SPRT3BF'), 'SPRT3B', 'lote fracionário especial deve normalizar para o ticker base');
assert.equal(normalizeTicker('QVQP3BF'), 'QVQP3B');
assert.equal(normalizeTicker('QVQP3B.SA'), 'QVQP3B');
assert.equal(normalizeTicker('QVQP3BSA'), 'QVQP3B');
assert.equal(normalizeTicker('G2DI33F'), 'G2DI33', 'fracionário de ticker alfanumérico especial deve normalizar');
assert.equal(normalizeTicker('G2DI33F.SA'), 'G2DI33');
assert.equal(normalizeTicker('G2DI33FSA'), 'G2DI33');

const missingValueShape = `
Ativos Cotação (R$) Variação 12m DY P/L P/VP ROE Margem Líquida
MATD3 HOSPITAL MATER DEI R$ 4,55 - 0,00% - 0,54 0,00% -
HVAN3 HAVAN R$ 10,00 - 0,00% - - 0,00% 0,00%
`;
const missingRows = parseCurrentInvestidor10PeerTable(missingValueShape);
assert.equal(missingRows.length, 2, 'placeholder não pode descartar a linha inteira');
assert.equal(missingRows[0].variation12mDisplay, '-');
assert.equal(missingRows[0].plDisplay, '-');
assert.equal(missingRows[1].pvpDisplay, '-');

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');
const modalSectionsSource = fs.readFileSync(new URL('../lib/analysis/asset-modal-sections.js', import.meta.url), 'utf8');
assert.match(stockSource, /COMPARANDO\\s\+\[A-Z0-9\]\{4,12\}\\s\+COM\\s\+OUTRAS/);
assert.match(stockSource, /currentTableDetected/);
assert.match(stockSource, /columns:\s*stockPeerColumnsForRows\(rows, \{ layout: currentTableDetected \? 'current' : 'auto' \}\)/);
assert.match(stockSource, /stockPeerColumnsForRows\(rows, \{ layout: 'current' \}\)/, 'recovery deve manter as sete colunas do comparador público atual');
assert.match(stockSource, /layout === 'current'\) return currentDefinitions/, 'layout atual deve preservar colunas mesmo quando a fonte usa placeholder');
assert.match(stockSource, /const wantsPeerComparisonRecovery = !targetedRecovery \|\| recoveryTarget\.sections\.has\('peerComparison'\)/);
assert.match(stockSource, /referenceRefetched:\s*!initialReference/);
assert.match(modalSectionsSource, /STOCK_MODAL_RECOVERABLE_SECTIONS[\s\S]*'peerComparison'/, 'peerComparison precisa aceitar recovery direcionado no catálogo canônico compartilhado');
assert.match(stockSource, /const STOCK_RECOVERABLE_SECTIONS = STOCK_MODAL_RECOVERABLE_SECTIONS/, 'contrato stock deve consumir o catálogo compartilhado');
const criticalBlock = runtimeSource.slice(runtimeSource.indexOf('const STOCK_CRITICAL_SECTIONS'), runtimeSource.indexOf('const FII_CRITICAL_SECTIONS'));
assert.doesNotMatch(criticalBlock, /'peerComparison'/, 'comparador não deve bloquear cache global; APK solicita recovery da seção');
assert.match(runtimeSource, /status === 'EMPTY'\) return 'EMPTY_UNCONFIRMED'/);

console.log('stock-peer-investidor10-live-v424 ok');
