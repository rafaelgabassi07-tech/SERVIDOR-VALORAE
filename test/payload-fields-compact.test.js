import assert from 'node:assert/strict';
import { compactPayload, shapeResponsePayload } from '../lib/http/response-shape.js';

const compact = compactPayload({ ok: true, a: null, b: [], c: {}, d: { x: 1, y: null }, e: ['x', null, []] });
assert.deepEqual(compact, { ok: true, d: { x: 1 }, e: ['x'] });
const shaped = shapeResponsePayload({ htmlPreview: 'abcdef', empty: [] }, { previewChars: 3, compact: true });
assert.deepEqual(shaped, { htmlPreview: 'abc' });
console.log('payload compact tests OK.');
