import { ValoraeEngine } from '../../lib/Valorae-engine.js';
import { sendJson } from '../../lib/performance/http.js';
import { beginRoute } from '../../lib/http/route.js';

const jsClient = `export async function getValoraeAsset(ticker, options = {}) {
  const baseUrl = (options.baseUrl || 'https://servidor-valorae.vercel.app').replace(/\\/$/, '');
  const url = new URL(baseUrl + '/api/v1/asset');
  const controller = new AbortController();
  const timeoutMs = Math.max(1500, Math.min(Number(options.timeoutMs || 12000), 30000));
  const timer = setTimeout(() => controller.abort(new Error('VALORAE_TIMEOUT')), timeoutMs);
  url.searchParams.set('ticker', String(ticker || '').toUpperCase());
  url.searchParams.set('view', options.view || 'app');
  url.searchParams.set('profile', options.profile || 'fast');
  url.searchParams.set('app', options.app || 'Meu App Web');
  url.searchParams.set('channel', options.channel || 'web');
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': 'application/json',
        'x-valorae-app': options.app || 'Meu App Web',
        'x-valorae-channel': options.channel || 'web',
        'x-valorae-app-version': options.appVersion || '1.0.0',
        'x-valorae-build': options.build || 'release',
        ...(options.appId ? {'x-valorae-app-id': options.appId} : {}),
        ...(options.clientKey ? {'x-valorae-client-key': options.clientKey} : {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.code || 'Erro Valorae');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function pickFirstPaint(data) {
  return data.appMobileSnapshot || data.appPayload || data;
}

export function shouldReplaceLocalCache(data) {
  if (!data || data.status === 'ERROR') return false;
  if (data.contractBaseline?.canReplacePrevious === false) return false;
  if (data.appResponseIntegrity?.cacheSafe === false) return false;
  if (data.engineLaunchGate?.decision === 'hold_previous_snapshot') return false;
  return true;
}`;

const kotlinClient = `suspend fun getValoraeAsset(baseUrl: String, ticker: String): JSONObject {
  val url = "${'$'}{baseUrl.trimEnd('/')}/api/v1/asset?ticker=${'$'}ticker&view=app&app=VALORAE%20APK&channel=android"
  val request = Request.Builder()
    .url(url)
    .header("Accept", "application/json")
    .header("x-valorae-app", "VALORAE APK")
    .header("x-valorae-channel", "android")
    .header("x-valorae-app-version", "1.0.0")
    .header("x-valorae-build", "release")
    .build()
  client.newCall(request).execute().use { response ->
    val body = response.body?.string().orEmpty()
    if (!response.isSuccessful) throw IOException(body)
    return JSONObject(body)
  }
}`;

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'integration/sdk', rateMax: Number(process.env.VALORAE_RATE_LIMIT_HEALTH_MAX || 180), profile: 'integration-sdk', cacheControl: 'private, max-age=120' });
  if (route.done) return;
  return sendJson(req, res, {
    version: ValoraeEngine.version,
    requestId: route.requestId,
    endpoint: 'integration/sdk',
    status: 'OK',
    recommendedView: 'app',
    readinessEndpoint: '/api/v1/release/readiness',
    stableRoots: ['contractBaseline', 'fieldObservability', 'appMobileSnapshot', 'appPayload', 'appSyncEnvelope', 'appResponseIntegrity', 'engineLaunchGate', 'engineRuntimeProfiler'],
    headers: ['x-valorae-observability-accept', 'x-valorae-app', 'x-valorae-channel', 'x-valorae-app-version', 'x-valorae-build', 'x-valorae-app-id', 'x-valorae-client-key'],
    examples: { javascript: jsClient, kotlinAndroid: kotlinClient },
    personalUseDefaults: { view: 'app', keepLastGoodSnapshot: true, sendAppHeaders: true, optionalAuthEnv: ['VALORAE_CLIENT_KEYS','VALORAE_REQUIRE_CLIENT_AUTH'], monitorEndpoint: '/api/server/metrics' },
    rules: [
      'Use view=app para produção e view=full/debug apenas para diagnóstico.',
      'Renderize appMobileSnapshot primeiro e hidrate com appPayload.',
      'Não substitua cache local quando contractBaseline.canReplacePrevious=false ou appResponseIntegrity.cacheSafe=false.',
      'Use fieldObservability apenas para diagnóstico; respeite hiddenFromUi=true.',
      'Envie x-valorae-app e x-valorae-channel para o monitor separar apps e canais.',
      'Antes de compartilhar com pessoas próximas, verifique /api/v1/release/readiness.',
      'Use timeout no cliente e preserve o último snapshot bom quando a decisão do gate for hold_previous_snapshot.'
    ],
  }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'integration-sdk', cachePolicy: 'etag', cacheControl: 'private, max-age=120' });
}
