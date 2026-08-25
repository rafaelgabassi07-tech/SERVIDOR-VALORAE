import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkExposureAlignedMonthMap } from '../lib/portfolio/return-metrics.js';

test('entrada parcial bloqueia somente o próprio mês e não o restante do ciclo', () => {
  const benchmark = [
    { month: '2025-10', accumulatedPercent: 0 },
    { month: '2025-11', accumulatedPercent: 1 },
    { month: '2025-12', accumulatedPercent: 2.01 },
    { month: '2026-01', accumulatedPercent: 3.0301 },
    { month: '2026-02', accumulatedPercent: 4.060401 }
  ];
  const portfolio = [
    { month: '2025-11', chartSegmentId: 1, exposureCycleId: 1, segmentStart: true, partialExposureMonth: true },
    { month: '2025-12', chartSegmentId: 1, exposureCycleId: 1, segmentStart: false, partialExposureMonth: false },
    { month: '2026-01', chartSegmentId: 1, exposureCycleId: 1, segmentStart: false, partialExposureMonth: false },
    { month: '2026-02', chartSegmentId: 1, exposureCycleId: 1, segmentStart: false, partialExposureMonth: false }
  ];

  const values = benchmarkExposureAlignedMonthMap(benchmark, 'accumulatedPercent', portfolio, '');
  assert.equal(values.has('2025-11'), false);
  assert.ok(Math.abs(values.get('2025-12') - 1) < 0.0001);
  assert.ok(Math.abs(values.get('2026-01') - 2.01) < 0.0001);
  assert.ok(Math.abs(values.get('2026-02') - 3.0301) < 0.0001);
  assert.equal(values.size, 3);
});

test('reentrada parcial não faz benchmark acumular durante meses sem capital', () => {
  const benchmark = [
    { month: '2026-01', accumulatedPercent: 0 },
    { month: '2026-02', accumulatedPercent: 1 },
    { month: '2026-03', accumulatedPercent: 2.01 },
    { month: '2026-04', accumulatedPercent: 3.0301 },
    { month: '2026-05', accumulatedPercent: 4.060401 },
    { month: '2026-06', accumulatedPercent: 5.10100501 }
  ];
  const portfolio = [
    { month: '2026-02', chartSegmentId: 1, exposureCycleId: 1, segmentStart: true, partialExposureMonth: false },
    { month: '2026-03', chartSegmentId: 1, exposureCycleId: 1, segmentStart: false, partialExposureMonth: false },
    // Abril ficou totalmente sem capital e portanto não aparece no contrato.
    { month: '2026-05', chartSegmentId: 2, exposureCycleId: 2, segmentStart: true, partialExposureMonth: true },
    { month: '2026-06', chartSegmentId: 2, exposureCycleId: 2, segmentStart: false, partialExposureMonth: false }
  ];

  const values = benchmarkExposureAlignedMonthMap(benchmark, 'accumulatedPercent', portfolio, '');
  assert.ok(Math.abs(values.get('2026-02') - 1) < 0.0001);
  assert.ok(Math.abs(values.get('2026-03') - 2.01) < 0.0001);
  assert.equal(values.has('2026-05'), false);
  // O novo ciclo usa maio apenas como base e reinicia a acumulação; junho representa só o retorno do novo ciclo.
  assert.ok(Math.abs(values.get('2026-06') - 1) < 0.0001);
});
