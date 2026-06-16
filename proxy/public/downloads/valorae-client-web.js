export class ValoraeProxyClient {
  constructor({ baseUrl = 'https://servidor-valorae.vercel.app', timeoutMs = 12000 } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'accept': 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  health() { return this.request('/api/health'); }
  ready() { return this.request('/api/ready'); }
  asset(ticker) { return this.request(`/api/asset?ticker=${encodeURIComponent(ticker)}`); }
  assets(tickers) { return this.request(`/api/assets?tickers=${encodeURIComponent(tickers.join(','))}`); }
  metrics() { return this.request('/api/server/metrics'); }
  analyzePortfolio(portfolio) { return this.request('/api/portfolio/analyze', { method: 'POST', body: portfolio }); }
}
