// ── Pool de User-Agents (espelha o NexusEngineUltra para consistência) ────
// O Android não envia body.headers com UA, então o scrape é responsável
// por rotacionar por conta própria no momento do fetch real.
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
];

// ── Domínios permitidos (allowlist anti-SSRF) ──────────────────────────────
// Toda URL enviada ao proxy é validada contra esta lista antes do fetch.
// Sem isto qualquer cliente pode usar o servidor como relay para atacar
// serviços internos ou exfiltrar dados de terceiros (SSRF).
const ALLOWED_HOSTS = new Set([
  'investidor10.com.br',
  'www.investidor10.com.br',
  'statusinvest.com.br',
  'www.statusinvest.com.br',
]);

// Vercel Hobby: limite de 10 s por função. Usamos 8 s para deixar margem.
const FETCH_TIMEOUT_MS = 8_000;

// Headers Sec-Fetch-* + Client Hints que o Cloudflare analisa para distinguir
// navegadores reais de bots. Omiti-los aumenta muito a chance de bloqueio.
const STEALTH_HEADERS = {
  'Sec-Ch-Ua':          '"Chromium";v="136", "Google Chrome";v="136", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile':   '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest':     'document',
  'Sec-Fetch-Mode':     'navigate',
  'Sec-Fetch-Site':     'none',
  'Sec-Fetch-User':     '?1',
  'Upgrade-Insecure-Requests': '1',
};

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export default async function handler(req: any, res: any) {
  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cache-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // ── Validação do payload ──────────────────────────────────────────────────
  const body = req.body;
  if (!body?.url || typeof body.url !== 'string') {
    return res.status(400).json({ error: 'Envie a URL no formato: {"url": "https://..."}' });
  }

  // ── Validação da URL (anti-SSRF) ─────────────────────────────────────────
  let parsedUrl;
  try {
    parsedUrl = new URL(body.url);
  } catch {
    return res.status(400).json({ error: 'URL inválida.' });
  }

  if (parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Apenas URLs HTTPS são permitidas.' });
  }

  if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    return res.status(403).json({ error: `Domínio não permitido: ${parsedUrl.hostname}` });
  }

  // ── Resolução do User-Agent ───────────────────────────────────────────────
  const forwarded = (body.headers && typeof body.headers === 'object') ? body.headers : {};
  const {
    'X-Cache-Version': _cv,    // header interno do Nexus — não repassar ao alvo
    'host': _h,
    'authorization': _a,
    'cookie': _c,              // nunca repassar cookies do cliente ao site-alvo
    ...safeForwarded
  } = forwarded;

  // Usa UA do body.headers se veio do engine; caso contrário rotaciona do pool
  const userAgent = safeForwarded['User-Agent'] || randomUA();

  // ── Fetch com timeout ─────────────────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startMs    = Date.now();

  try {
    const fetchRes = await fetch(body.url, {
      signal: controller.signal,
      headers: {
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control':   'no-cache',
        'Pragma':          'no-cache',
        'Referer':         `https://${parsedUrl.hostname}/`,
        ...STEALTH_HEADERS,
        ...safeForwarded,
        'User-Agent': userAgent,
      },
    });

    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startMs;

    // ── Propaga erros HTTP do site-alvo ───────────────────────────────────
    if (!fetchRes.ok) {
      return res.status(502).json({
        error: `Site-alvo retornou ${fetchRes.status} ${fetchRes.statusText}`,
        metrics: { statusCode: fetchRes.status, elapsedMs },
      });
    }

    const html = await fetchRes.text();

    // ── Resposta ──────────────────────────────────────────────────────────
    return res.status(200).json({
      html,
      data: html,
      metrics: {
        cacheStatus:   'MISS',
        statusCode:    fetchRes.status,
        elapsedMs,
        contentLength: html.length,
        uaSource:      safeForwarded['User-Agent'] ? 'engine' : 'pool',
      },
    });

  } catch (error: any) {
    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startMs;

    const isTimeout = error.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout
        ? `Timeout: o site-alvo não respondeu em ${FETCH_TIMEOUT_MS}ms`
        : `Erro no proxy: ${error.message}`,
      metrics: { elapsedMs },
    });
  }
}
