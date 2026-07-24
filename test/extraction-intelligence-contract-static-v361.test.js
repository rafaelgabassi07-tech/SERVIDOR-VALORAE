import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VALORAE_EXTRACTION_INTELLIGENCE_VERSION,
} from '../lib/core/feature-versions.js';
import {
  VALORAE_NETWORK_JSON_CAPTURE_IMPLEMENTATION,
  VALORAE_NETWORK_JSON_CAPTURE_POLICY,
} from '../lib/scrape/network-json-capture.js';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const contract = JSON.parse(read('contracts/checkpoint126/extraction-intelligence.json'));
assert.equal(contract.version, VALORAE_EXTRACTION_INTELLIGENCE_VERSION);
assert.equal(contract.policyVersion, 'safe-sanitized-json-sandboxed-browser-bounded-transport-v4');
assert.ok(contract.features.includes('captured-json-sensitive-field-removal'));
assert.ok(contract.features.includes('collector-pending-backpressure-and-settle-timeout'));
assert.ok(contract.features.includes('per-request-browser-dns-preflight'));
assert.ok(contract.features.includes('local-chromium-sandbox-enabled-by-default'));
assert.ok(contract.features.includes('bounded-lru-undici-provider-pools'));

const dynamic = read('lib/scrape/dynamic-render-fallback.js');
assert.ok(dynamic.includes("page.on('response', networkCollector.observe)"));
assert.ok(dynamic.includes('serviceWorkers: \'block\''));
assert.ok(dynamic.includes('VALORAE_NETWORK_JSON_CAPTURE_POLICY'));
assert.ok(dynamic.includes('VALORAE_NETWORK_JSON_CAPTURE_IMPLEMENTATION'));
assert.ok(dynamic.includes('captureDynamicPageData'));

const structured = read('lib/scrape/structured-data-discovery.js');
for (const marker of ['hydration-attribute', 'network-json', 'next-flight-json', 'data-sveltekit-fetched', '__APOLLO_STATE__', 'additionalDocuments', '!valuePresent(merged[key])', 'structured-gap-fill']) {
  assert.ok(structured.includes(marker), `structured discovery missing ${marker}`);
}

const networkSafety = read('lib/scrape/network-safety.js');
for (const marker of ['BLOCKED_IPV6_CIDRS', 'parseIpv6BigInt', "host.endsWith('.internal')", 'forceRefresh', 'resolvePublicHost', 'isPrivateOrSpecialIpAddress']) {
  assert.ok(networkSafety.includes(marker), `network safety missing ${marker}`);
}

const assetDetails = read('lib/sources/asset-details.js');
for (const marker of ['captureDynamicPageData', 'known-endpoint-gap-fill', 'playwright-network-json', 'classifyKnownInternalEndpoint']) {
  assert.ok(assetDetails.includes(marker), `live asset pipeline missing ${marker}`);
}

const router = read('routes/_router.js');
assert.ok(router.includes('/contract/extraction-intelligence'));
assert.ok(router.includes('buildExtractionIntelligenceManifest'));
const http = read('lib/core/http.js');
assert.ok(http.includes("X-Valorae-Extraction-Intelligence"));
const mobile = read('lib/core/mobile-protocol.js');
assert.ok(mobile.includes('X-Valorae-Extraction-Intelligence-Accept'));

const apkRoot = process.env.VALORAE_APK_ROOT;
if (apkRoot) {
  const apkRead = relative => fs.readFileSync(`${apkRoot}/${relative}`, 'utf8');
  const apkProtocol = apkRead('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
  const apkHttp = apkRead('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
  const apkContract = apkRead('app/src/main/java/com/example/data/proxy/ValoraeExtractionIntelligence.kt');
  assert.ok(apkProtocol.includes('HeaderExtractionIntelligenceAccept'));
  assert.ok(apkHttp.includes('ValoraeExtractionIntelligenceContract.PolicyVersion'));
  assert.ok(apkContract.includes(VALORAE_EXTRACTION_INTELLIGENCE_VERSION));
  assert.ok(apkContract.includes('safeForCurrentApk'));
}

const jsonSafety = read('lib/scrape/json-safety.js');
for (const marker of ['sanitizeCapturedJson', 'PROTOTYPE_KEYS', 'SECRET_KEYS', 'PERSONAL_KEYS', 'maxDepth', 'maxNodes']) {
  assert.ok(jsonSafety.includes(marker), `json safety missing ${marker}`);
}
const transport = read('lib/http/provider-transport.js');
for (const marker of ['VALORAE_HTTP_MAX_POOLS', 'poolEvictions', 'globallyBoundedPoolCountWithLruEviction']) {
  assert.ok(transport.includes(marker), `provider transport missing ${marker}`);
}
console.log('extraction-intelligence-contract-static-v362 ok');
