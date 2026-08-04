import process from 'node:process';
import { pathToFileURL } from 'node:url';

function cleanUrl(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:rest|auth|storage|functions)\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function deploymentConfig(env = process.env) {
  const url = cleanUrl(env.SUPABASE_URL || env.VALORAE_SUPABASE_URL || '');
  const key = String(
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    env.VALORAE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  return { url, key, configured: url.startsWith('https://') && Boolean(key) };
}

async function probe(config, path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), 20_000);
  timer.unref?.();
  try {
    const response = await fetch(`${config.url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) {
      const code = body?.code || `HTTP_${response.status}`;
      const message = body?.message || body?.hint || String(body || 'erro sem corpo');
      throw new Error(`${code}: ${message}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyCloudSyncDeployment(env = process.env) {
  const config = deploymentConfig(env);
  if (!config.configured) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos no ambiente do Proxy.');
  }

  const checks = [
    ['transactions table', '/rest/v1/valorae_financial_transactions?select=client_tx_id&limit=1', {}],
    ['dividends table', '/rest/v1/valorae_financial_dividends?select=event_id&limit=1', {}],
    ['status RPC', '/rest/v1/rpc/valorae_financial_status_v2', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ p_user_id: '00000000-0000-0000-0000-000000000000' }),
    }],
  ];

  for (const [label, path, init] of checks) {
    await probe(config, path, init);
    console.log(`OK ${label}`);
  }
  console.log('Cloud transaction sync deployment READY');
  return true;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  verifyCloudSyncDeployment().catch((error) => {
    console.error(`Cloud transaction sync deployment NOT READY: ${error?.message || error}`);
    process.exitCode = 1;
  });
}
