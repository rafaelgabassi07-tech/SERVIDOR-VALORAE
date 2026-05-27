# Valorae Proxy - Quickstart

```js
const VALORAE_PROXY_URL = '{{VALORAE_PROXY_URL}}/api';

async function consultarAtivo(ticker) {
  const response = await fetch(`${VALORAE_PROXY_URL}/asset?ticker=${encodeURIComponent(ticker)}&mode=basic&view=compact`, {
    headers: {
      'Accept': 'application/json',
      'X-Valorae-Client-Id': 'site-terceiro-producao'
    }
  });

  if (!response.ok) throw new Error(`Valorae Proxy HTTP ${response.status}`);
  const data = await response.json();
  if (data.status === 'PARTIAL') console.warn('Dados parciais do Valorae Proxy', data.warnings || []);
  return data;
}
```
