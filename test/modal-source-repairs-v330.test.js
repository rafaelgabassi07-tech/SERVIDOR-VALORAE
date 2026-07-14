import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test as fii } from '../lib/analysis/fii-modal-contract.js';
import { _test as stock } from '../lib/analysis/stock-modal-contract.js';
import { _test as indexHistory } from '../lib/market/investidor10-index-history.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.equal(pkg.valorae.publicVersion, '21.12.366');
assert.equal(pkg.valorae.releasePatch, '21.12.366-multisource-official-logo-v334');
assert.equal(metadata.apkVersion, '2026.07.14.01');
assert.equal(fii.FII_MODAL_VERSION, '26.asset-modal.fii.v25-modal-source-repair');
assert.equal(stock.STOCK_MODAL_VERSION, '26.asset-modal.stock.v58-modal-source-repair');

const fiiChecklistHtml = `
  <section id="checklist">
    <div class="checklist-item">
      <input type="checkbox" id="styled-checkbox-years" checked disabled>
      <label>FII com mais de 5 anos listado em Bolsa <i data-content="Tempo desde a primeira cotação."></i></label>
    </div>
    <div class="checklist-item">
      <input type="checkbox" id="styled-checkbox-dy" disabled>
      <label>Dividend Yield médio dos últimos 24 meses acima de 9% <i data-content="Média dos últimos 24 meses."></i></label>
    </div>
  </section>`;
const fiiChecklist = fii.extractInvestidor10FiiBuyHoldChecklist(fiiChecklistHtml, 'TEST11');
assert.equal(fiiChecklist.total, 2);
assert.equal(fiiChecklist.passed, 1);
assert.equal(fiiChecklist.failed, 1);
assert.equal(fiiChecklist.unknown, 0);
assert.equal(fiiChecklist.items[0].dataNature, 'DIRECT');
assert.match(fiiChecklist.items[0].evidence, /atributo checked/i);
assert.match(fiiChecklist.items[1].evidence, /sem o atributo checked/i);

const peerRows = fii.normalizeInvestidor10FiiPeerApi({
  data: [
    { title: 'MXRF11', dividend_yield: 12.31, p_vp: 1.04, net_worth: 4313692471, type: 'Fundo de Papel', segment: 'Híbrido' },
    { title: 'IRIM11', dividend_yield: 13.1, p_vp: 0.98, net_worth: 2953072420, type: 'Fundo de Papel', segment: 'Híbrido' }
  ]
}, 'MXRF11');
assert.equal(peerRows.length, 2);
assert.equal(peerRows[0].fundType, 'Fundo de Papel');
assert.equal(peerRows[0].segment, 'Híbrido');
assert.equal(peerRows[1].patrimonialValue, 2953072420);

const stockChecklistHtml = `
  <div id="checklist">
    <div class="checklist-item">
      <input type="checkbox" id="styled-checkbox-years" checked disabled>
      <label>Empresa com mais de 5 anos de Bolsa <i data-content="Histórico mínimo de negociação."></i></label>
    </div>
    <div class="checklist-item">
      <input type="checkbox" id="styled-checkbox-profitable" disabled>
      <label>Empresa nunca deu prejuízo (ano fiscal) <i data-content="Consistência anual de lucro."></i></label>
    </div>
  </div>`;
const stockChecklist = stock.extractInvestidor10StockBuyHoldChecklist(stockChecklistHtml, 'PETR4');
assert.equal(stockChecklist.total, 2);
assert.equal(stockChecklist.passed, 1);
assert.equal(stockChecklist.failed, 1);
assert.equal(stockChecklist.unknown, 0);
assert.equal(stockChecklist.diagnostics.directCount, 2);
assert.equal(stockChecklist.items[1].status, 'FAILED');

const payoutRows = stock.normalizeStockPayoutDedicatedSource({
  profitabilityArray: {
    2: { year: '2017', value: 377000000 },
    3: { year: '2018', value: 26698000000 }
  },
  payOutCompanyIndicators: [
    { year: '2017', value: 0 },
    { year: '2018', value: 9.99 }
  ],
  dyTickerIndicators: [
    { year: '2017', value: 0 },
    { year: '2018', value: 0.88 }
  ]
}, { ticker: 'PETR4' });
assert.deepEqual(payoutRows.map(row => row.label), ['2017', '2018']);
assert.equal(payoutRows[0].netIncome, 377000000);
assert.equal(payoutRows[1].netIncome, 26698000000);
assert.equal(payoutRows[1].payoutPercent, 9.99);

const indexRows = indexHistory.normalizeInvestidor10IndexHistory([
  { points: '3.500,10', last_update: '31/01/2026' },
  { points: '3550.20', last_update: '27/02/2026' },
  { points: '3601.30', last_update: '31/03/2026' }
], { indexCode: 'IFIX', months: 24 });
assert.equal(indexRows.length, 3);
assert.equal(indexRows[0].close, 3500.1);
assert.equal(indexRows[2].date, '2026-03-31');
assert.equal(indexRows[2].proxyTickerUsed, false);
assert.equal(indexHistory.INDEX_IDS.IFIX, 22);
assert.equal(indexHistory.INDEX_IDS.SMLL, 6);
assert.equal(indexHistory.INDEX_IDS.IDIV, 8);
assert.equal(indexHistory.INDEX_IDS.IBOV, 1);

const apkHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const apkService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const apkQuality = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalQuality.kt');
const apkReadiness = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalSectionReadiness.kt');
const apkBuild = readSiblingApkFile('app/build.gradle.kts');
if ([apkHttp, apkService, apkQuality, apkReadiness, apkBuild].every(Boolean)) {
  assert.match(apkHttp, /\.readTimeout\(32, TimeUnit\.SECONDS\)/);
  assert.match(apkService, /"22000"/);
  assert.match(apkReadiness, /FiiAssetModalSection\.PeerComparison -> peerComparison/);
  assert.match(apkReadiness, /FiiAssetModalSection\.Checklist -> checklist/);
  assert.match(apkReadiness, /StockAssetModalSection\.Payout -> payoutChart/);
  assert.match(apkQuality, /val hasPayout = payoutChart\.points\.isNotEmpty\(\)/);
  assert.match(apkBuild, /versionCode = 26071401/);
}

console.log('modal source repairs v330 ok');
