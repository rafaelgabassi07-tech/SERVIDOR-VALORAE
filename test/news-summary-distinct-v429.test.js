import assert from 'node:assert/strict';
import { _test } from '../lib/sources/news.js';

const { distinctNewsSummary } = _test;
assert.equal(typeof distinctNewsSummary, 'function');

assert.equal(
  distinctNewsSummary('Empresa anuncia dividendos', 'Empresa anuncia dividendos', ''),
  '',
  'resumo idêntico ao título deve desaparecer'
);
assert.equal(
  distinctNewsSummary('Empresa anuncia dividendos', 'Empresa anuncia dividendos - Portal Financeiro', ''),
  '',
  'título seguido apenas da fonte não deve virar resumo'
);
assert.equal(
  distinctNewsSummary(
    'Empresa anuncia dividendos',
    'Empresa anuncia dividendos - Portal Financeiro',
    'A companhia aprovou pagamento de R$ 2 por ação para o próximo mês, segundo comunicado ao mercado.'
  ),
  'A companhia aprovou pagamento de R$ 2 por ação para o próximo mês, segundo comunicado ao mercado.',
  'quando o feed não tem resumo distinto, o corpo real deve ser usado'
);
assert.equal(
  distinctNewsSummary(
    'Empresa anuncia dividendos',
    'A companhia aprovou pagamento de R$ 2 por ação no próximo mês.',
    ''
  ),
  'A companhia aprovou pagamento de R$ 2 por ação no próximo mês.',
  'resumo editorial distinto deve ser preservado'
);

console.log('news summary distinct v429: OK');
