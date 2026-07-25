import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const readApk = relative => { try { return fs.readFileSync(path.resolve(root, '..', 'apk', relative), 'utf8'); } catch { return ''; } };

const index = read('public/index.html');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const logo = read('public/assets/valorae-logo.svg');
const monitorUi = read('public/monitor-valorae.js');
const persistence = read('lib/observability/monitor-persistence.js');
const metrics = read('lib/observability/server-metrics.js');

assert.match(index, /<title>V-Proxy · Central operacional<\/title>/);
assert.match(index, /<strong>V-Proxy<\/strong>/);
assert.equal(manifest.name, 'V-Proxy');
assert.equal(manifest.start_url, '/monitor');
assert.match(logo, /<title id="title">V-Proxy<\/title>/);
assert.match(persistence, /const enabled = false/);
assert.match(metrics, /pollingHintMs:\s*30000/);
assert.match(metrics, /mode: 'memory-observability'/);
assert.match(metrics, /persistent: false/);
assert.match(monitorUi, /storage\.get\(STORAGE\.poll, '30000'\)/);
assert.match(monitorUi, /bounded\(storage\.get\(STORAGE\.poll, '30000'\), 30000, 15000, 120000\)/);

const checklistUi = readApk('app/src/main/java/com/example/ui/AssetModalChecklistUi.kt');
if (checklistUi) {
  assert.doesNotMatch(checklistUi, /Calculado pelo VALORAE com dados da fonte/);
  assert.doesNotMatch(checklistUi, /text\s*=\s*"Não atende"/);
}
const analysisScreen = readApk('app/src/main/java/com/example/ui/AnalysisScreen.kt');
const discoveryUi = readApk('app/src/main/java/com/example/ui/AnalysisDiscoveryUi.kt');
if (analysisScreen && discoveryUi) {
  assert.match(analysisScreen, /updateMainSearch:\s*Boolean\s*=\s*true/);
  assert.match(analysisScreen, /updateMainSearch\s*=\s*false/);
  assert.match(discoveryUi, /localQuery\s*=\s*idea\.ticker\.cleanTickerInput\(\)/);
}
const patrimony = readApk('app/src/main/java/com/example/ui/PatrimonyTotalModalComponents.kt');
const dashboard = readApk('app/src/main/java/com/example/ui/PortfolioDashboardModalUi.kt');
const cachePolicy = readApk('app/src/main/java/com/example/data/cache/ValoraeCachePolicy.kt');
if (patrimony && dashboard && cachePolicy) {
  assert.match(patrimony, /mutableStateOf\("Linha"\)/);
  assert.match(patrimony, /"Barras" to Icons\.Rounded\.BarChart/);
  assert.doesNotMatch(patrimony, /Alocação por classe/);
  assert.match(dashboard, /returnsContract\s*=\s*modalReturnsContract/);
  assert.match(cachePolicy, /QuoteTtlMs\s*=\s*2L \* 60L \* 1000L/);
  assert.match(cachePolicy, /NewsTtlMs\s*=\s*15L \* 60L \* 1000L/);
}

console.log('v-proxy-patrimony-monitor-v364 ok');
