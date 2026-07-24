import assert from 'node:assert/strict';
import {
  extractNextFlightDocuments,
  VALORAE_NEXT_FLIGHT_DISCOVERY_VERSION,
} from '../lib/scrape/next-flight-discovery.js';

assert.match(VALORAE_NEXT_FLIGHT_DISCOVERY_VERSION, /next-flight-safe-static/);

const script = String.raw`
  self.__next_f.push([1,"1:{\"asset\":{\"ticker\":\"PETR4\",\"dividendYield\":8.5}}\n2:[{\"year\":2025,\"value\":42}]"]);
  self.__next_f.push([2,"3:I[123,[],\"default\"]\n4:{\"fund\":{\"ticker\":\"HGLG11\",\"pvp\":0.94}}"]);
  self.__next_f.push([3,"5:window.alert('never execute')"]);
`;

const documents = extractNextFlightDocuments(script);
assert.equal(documents.filter(item => item.kind === 'next-flight-frame').length, 3);
assert.equal(documents.filter(item => item.kind === 'next-flight-json').length, 3);
assert.ok(documents.some(item => item.data?.asset?.ticker === 'PETR4'));
assert.ok(documents.some(item => item.data?.fund?.ticker === 'HGLG11'));
assert.ok(documents.some(item => Array.isArray(item.data) && item.data[0]?.year === 2025));
assert.equal(documents.some(item => String(item.data).includes('alert')), false, 'expressões React Flight não podem ser executadas ou promovidas como JSON');

const malformed = extractNextFlightDocuments(`self.__next_f.push([1, window.secret]); self.__next_f.push(eval('x'));`);
assert.deepEqual(malformed, []);

const oversized = extractNextFlightDocuments(`self.__next_f.push([1,${JSON.stringify('x'.repeat(2000))}]);`, { maxDocumentBytes: 256 });
assert.deepEqual(oversized, []);

console.log('next-flight-discovery-v361 ok');
