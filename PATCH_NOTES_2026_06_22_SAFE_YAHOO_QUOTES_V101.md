# VALORAE Proxy v101 — Safe Yahoo Quotes

- Adicionado contrato seguro para `/api/v1/quotes` com suporte a batch de tickers.
- Cotações usam Yahoo Finance via Proxy com cache curto de 30 segundos.
- Adicionado backoff por ticker/símbolo quando houver 429, timeout ou falha remota, preservando a última cotação válida quando disponível.
- Concorrência de busca reduzida para evitar rajadas agressivas contra o provedor.
- `assets` e `quotes` expõem política de atualização recomendada para o APK.

Patch: `21.12.152-safe-yahoo-quotes-v101`.
