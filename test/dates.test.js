import assert from 'node:assert/strict';
import { normalizeDate, previousBusinessDayIso, eligibilityDateFromEvent } from '../lib/core/dates.js';
assert.equal(normalizeDate('10/06/2026'), '2026-06-10');
assert.equal(normalizeDate('10/06/26'), '2026-06-10');
assert.equal(previousBusinessDayIso('2026-06-15'), '2026-06-12');
assert.deepEqual(eligibilityDateFromEvent({ exDate: '15/06/2026' }), { date: '2026-06-12', source: 'exDatePreviousBusinessDay' });
