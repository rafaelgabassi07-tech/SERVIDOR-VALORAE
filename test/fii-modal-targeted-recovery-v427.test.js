import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');

test('FII targeted recovery retains the full recoverable surface', () => {
  for (const section of [
    'historicalIndicators', 'patrimonialInfo', 'indexComparison', 'announcements',
    'peerComparison', 'checklist', 'distributions12m', 'dividendCharts', 'aboutFund',
    'propertyPortfolio', 'vacancyHistory', 'information', 'returns'
  ]) {
    assert.match(contract, new RegExp(`['\"]${section}['\"]`));
  }
});

test('fast FII preview does not shorten the shared Investidor10 producer', () => {
  assert.match(contract, /sourceTimeoutMs\s*=\s*fastMode\s*\?\s*Math\.max\(Number\(timeoutMs\)\s*\|\|\s*0,\s*12000\)/);
});

test('patrimonial and checklist recovery request peer enrichment', () => {
  assert.match(contract, /recoveryTarget\.sections\.has\('peerComparison'\)[\s\S]*recoveryTarget\.sections\.has\('patrimonialInfo'\)[\s\S]*recoveryTarget\.sections\.has\('checklist'\)/);
});

test('checklist recovery also requests historical dividend yield', () => {
  assert.match(contract, /shouldFetchDividendYieldHistory[\s\S]*recoveryTarget\.sections\.has\('dividendCharts'\)[\s\S]*recoveryTarget\.sections\.has\('checklist'\)/);
});

test('paper FIIs settle physical-property and vacancy sections as not applicable', () => {
  assert.match(runtime, /\['propertyPortfolio',\s*'vacancyHistory'\]\.includes\(id\)\s*&&\s*isFiiWithoutPhysicalProperties\(payload\)/);
  assert.match(runtime, /status\s*=\s*'NOT_APPLICABLE'/);
});
