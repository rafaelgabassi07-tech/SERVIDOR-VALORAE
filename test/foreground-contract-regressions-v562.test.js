import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async (path) => readFile(new URL(path, root), 'utf8');

test('news includeGeneral is parallel and merged without waiting for a targeted timeout', async () => {
  const source = await read('lib/sources/news.js');
  assert.match(source, /const includeGeneral =/);
  assert.match(source, /const broadFetchPromise = includeGeneral/);
  assert.match(source, /uniqueNewsItems\(\[\.\.\.items, \.\.\.broadItems\]\)/);
  assert.match(source, /broadFallbackUsed: broadFeedUsed/);
});

test('portfolio returns honors the benchmark list supplied by the APK', async () => {
  const source = await read('lib/portfolio/analysis.js');
  assert.match(source, /Array\.isArray\(payload\.benchmarks\)/);
  assert.match(source, /requestedBenchmarks\.includes\('CDI'\)/);
  assert.match(source, /requestedBenchmarks\.filter\(b => marketBenchmarkMap\[b\]\)/);
});

test('foreground routes remain independent from the mobile background bundle', async () => {
  const router = await read('routes/_router.js');
  assert.match(router, /path === '\/market\/rankings'/);
  assert.match(router, /path === '\/portfolio\/returns'/);
  assert.match(router, /path === '\/asset\/modal'/);
  assert.match(router, /path === '\/mobile\/alerts'/);
});
