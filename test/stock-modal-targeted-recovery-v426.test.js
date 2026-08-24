import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectTargetedStockRecoveryTasks } from '../lib/analysis/stock-modal-recovery-policy.js';
import { _test as runtimeTest } from '../lib/analysis/asset-modal-runtime.js';

const fakeTasks = [];
for (let i = 0; i < 10; i += 1) fakeTasks.push(['revenueGeography', `https://example.test/geo/${i}`]);
for (let i = 0; i < 10; i += 1) fakeTasks.push(['revenueSegment', `https://example.test/segment/${i}`]);
fakeTasks.push(['payoutHistorico', 'https://example.test/payout']);
fakeTasks.push(['resultadoDre', 'https://example.test/dre']);
fakeTasks.push(['fluxoCaixa', 'https://example.test/cash']);
for (let i = 0; i < 6; i += 1) fakeTasks.push(['balanceSheetTable', `https://example.test/balance/${i}`]);
for (let i = 0; i < 8; i += 1) fakeTasks.push(['historicoIndicadores', `https://example.test/history/${i}`]);

const selected = selectTargetedStockRecoveryTasks(fakeTasks, { maxTotal: 24 });
const keys = selected.map(([key]) => key);
for (const required of ['payoutHistorico', 'resultadoDre', 'fluxoCaixa', 'balanceSheetTable', 'historicoIndicadores', 'revenueGeography', 'revenueSegment']) {
  assert.ok(keys.includes(required), `recuperação dirigida deve preservar ${required}`);
}
assert.ok(selected.length <= 24, 'fan-out dirigido deve respeitar orçamento total');
assert.ok(keys.filter(key => key === 'revenueGeography').length <= 5);
assert.ok(keys.filter(key => key === 'revenueSegment').length <= 5);
assert.ok(keys.filter(key => key === 'balanceSheetTable').length <= 4);
assert.ok(keys.filter(key => key === 'historicoIndicadores').length <= 4);

const dividendPayload = {
  dividendHistory: { events: [{ date: '2026-01-01', value: 1 }] },
  dividendRadar: { status: 'OK', months: [{ activePayment: true, paymentCount: 1 }] },
  payoutChart: { points: [] },
};
const sections = new Map(runtimeTest.stockModalSections(dividendPayload));
assert.equal(sections.get('dividends'), true, 'dividendos não podem depender do payout');
assert.equal(sections.get('payoutChart'), false, 'payout deve continuar independente');
const qualitySections = new Map(runtimeTest.stockModalQualitySections(dividendPayload));
assert.equal(qualitySections.get('dividends'), true, 'qualidade deve usar a mesma semântica de dividendos');
assert.equal(qualitySections.get('payoutChart'), false);

const incompleteCompany = {
  companyProfile: { facts: [{ value: 'Energia' }] },
  companyData: { facts: [] },
  companyInformation: { facts: [] },
};
assert.equal(new Map(runtimeTest.stockModalQualitySections(incompleteCompany)).get('company'), false,
  'cache/entrega não deve tratar apenas o perfil como empresa completa');

const incompleteRevenue = { revenueByRegion: { items: [{ label: 'SE', value: 1 }] }, revenueByBusiness: { items: [] } };
assert.equal(new Map(runtimeTest.stockModalQualitySections(incompleteRevenue)).get('revenueBreakdown'), false,
  'região sem negócios não deve encerrar o grupo de receitas');

const contractSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
assert.match(contractSource, /sourceTimeoutMs = fastMode \? Math\.max\(Number\(timeoutMs\) \|\| 0, 18000\)/,
  'preview não pode envenenar o producer compartilhado com timeout curto');
assert.match(contractSource, /key === 'payoutHistorico'\) return checklistRecovery \|\| sections\.has\('payoutChart'\)/,
  'recuperação de dividendos não deve disparar payout implicitamente');
assert.match(contractSource, /requested_sections_fair_fanout_v426/,
  'runtime deve usar fan-out dirigido real para seções faltantes');

console.log('stock modal targeted recovery v426: OK');
