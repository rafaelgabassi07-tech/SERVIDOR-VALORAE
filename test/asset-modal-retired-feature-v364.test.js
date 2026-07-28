import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/asset-modal-runtime.js';

const payload = {
  ticker: 'TEST3',
  analysisChanges: { summary: 'não deve sair' },
  company: {
    whatChanged: ['não deve sair'],
    facts: [{ label: 'Mudança de receita', value: '10%' }],
    nested: {
      assetAnalysisChanges: { status: 'OK' },
      changes: ['campo genérico legítimo']
    }
  },
  analysisChangeHistory: [{ date: '2026-01-01' }],
  checklist: { id: 'stock_buy_hold_checklist', total: 10, items: [] }
};

const clean = _test.stripRetiredAssetModalFeatures(payload);
assert.equal('analysisChanges' in clean, false);
assert.equal('whatChanged' in clean.company, false);
assert.equal('assetAnalysisChanges' in clean.company.nested, false);
assert.equal('analysisChangeHistory' in clean, false);
assert.deepEqual(clean.company.nested.changes, ['campo genérico legítimo']);
assert.equal(clean.company.facts.length, 1);

const decorated = _test.decorateModalPayload(payload, { family: 'stock', mode: 'full', requestPayload: {} });
assert.equal('analysisChanges' in decorated, false);
assert.equal('whatChanged' in decorated.company, false);
console.log('asset modal retired what-changed feature stripped recursively');
