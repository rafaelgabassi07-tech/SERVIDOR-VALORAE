import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const htmlWithPollutedPage = `
<html><body>
  <h2>INDICADORES FUNDAMENTALISTAS PETR4</h2>
  <div>P/VP 1,09 ROE 24,17% DY 7,69%</div>
  <h2>POSIÇÃO ACIONÁRIA DA PETR4</h2>
  <table><tr><th>Acionista</th><th>% ON</th><th>% PN</th><th>% Total</th></tr>
    <tr><td>UNIÃO FEDERAL</td><td>50,26%</td><td>0,00%</td><td>29,02%</td></tr>
    <tr><td>BLACKROCK INC</td><td>3,94%</td><td>7,20%</td><td>5,32%</td></tr>
  </table>
  <h2>Receitas e Lucros</h2>
  <h2>Discussão</h2>
  <p>Vou vender PETR4, sou iniciante, P/VP 1,09, ROE 24,17, DY 7,69</p>
</body></html>`;
const shareholding = _test.buildStockShareholdingPayload({ html: htmlWithPollutedPage, ticker: 'PETR4' });
assert.equal(shareholding.status, 'OK');
assert.deepEqual(shareholding.rows.map(row => row.shareholder), ['UNIÃO FEDERAL', 'BLACKROCK INC']);
assert.equal(shareholding.rows.find(row => /BLACKROCK/i.test(row.shareholder))?.totalPercentDisplay, '5,32%');
assert.ok(!shareholding.rows.some(row => /P\/VP|ROE|DY|vou vender|iniciante/i.test(row.shareholder)), 'posição acionária não pode capturar indicadores ou discussão');

const htmlWithoutRowsButWithPageNoise = `
<html><body>
  <h2>POSIÇÃO ACIONÁRIA DA VALE3</h2>
  <div>Acionista % ON % PN % Total</div>
  <h2>Receitas e Lucros</h2>
  <h2>Discussão</h2>
  <p>P/VP 1,45 2,33 3,44</p><p>sou iniciante 10 20 30</p>
</body></html>`;
const emptyStrict = _test.buildStockShareholdingPayload({ html: htmlWithoutRowsButWithPageNoise, ticker: 'VALE3' });
assert.equal(emptyStrict.status, 'EMPTY');
assert.equal(emptyStrict.rows.length, 0, 'sem rows oficiais/JSON, não deve varrer a página inteira');
assert.equal(emptyStrict.diagnostics.policy, 'strict_scoped_section_or_shareholding_json_only_no_full_page_fallback');

const historicAliasPayload = {
  data: {
    historicIndicators: {
      columns: ['Atual', '2025', '2024'],
      rows: [
        { label: 'P/L', values: { Atual: 4.52, 2025: 3.61, 2024: 12.74 } },
        { label: 'P/VP', values: { Atual: 1.09, 2025: 0.96, 2024: 1.27 } },
        { label: 'ROE', values: { Atual: 24.17, 2025: 26.49, 2024: 10.00 }, unit: 'percent' }
      ]
    }
  }
};
const history = _test.buildStockHistoricalIndicators(
  _test.buildStockHistoricalIndicatorSources({ ticker: 'PETR4', apiExtras: { rawJson: { assetTickerRest: historicAliasPayload } } }),
  'PETR4',
  {}
);
assert.equal(history.status, 'OK');
assert.equal(history.rows.find(row => row.label === 'P/L')?.values.Atual, '4,52');
assert.equal(history.rows.find(row => row.label === 'P/VP')?.values['2024'], '1,27');
assert.equal(history.rows.find(row => row.label === 'ROE')?.values['2025'], '26,49%');

const source = fs.readFileSync('lib/analysis/stock-modal-contract.js', 'utf8');
assert.ok(source.includes("26.asset-modal.stock.v56-progressive-fast-full"), 'contrato de ação deve avançar para v54');
assert.ok(source.includes('/api/acoes/historico-indicadores/${symbol.toLowerCase()}'), 'deve consultar endpoint histórico por ticker como fallback real');
assert.ok(!source.includes('parseStockShareholdingRowsFromSection(plain);'), 'shareholding não pode usar fallback de página inteira');
assert.ok(source.includes('historicalIndicatorRows: (investidor10?.historicalIndicators?.rows || []).length'), 'diagnóstico de histórico deve refletir rows reais');

console.log('stock-modal-data-integrity-v268 ok');
