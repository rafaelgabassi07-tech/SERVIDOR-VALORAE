import assert from 'node:assert/strict';
import { normalizeB3Range } from '../lib/market/b3-calendar.js';

const cases = {
  '1d': '1D',
  '5d': '5D',
  '1mo': '1M',
  '3mo': '3M',
  '6mo': '6M',
  '1y': '1Y',
  '2y': '2Y',
  '5y': '5Y',
  max: 'MAX',
  tudo: 'MAX',
  '1 mês': '1M',
  '3 meses': '3M',
  '6 meses': '6M',
};

for (const [input, expected] of Object.entries(cases)) {
  assert.equal(normalizeB3Range(input), expected, `range ${input} should normalize to ${expected}`);
}

console.log('Portfolio history range aliases v273 OK.');
