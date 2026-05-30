# Benchmark scraping VALORAE

Gerado em 2026-05-30T02:29:03.066Z. Rede: mocked/local-only.

| Caso | loops | média ms | mediana ms | p95 ms |
|---|---:|---:|---:|---:|
| fast-selectors-single-pass | 120 | 1.414 | 1.235 | 2.149 |
| custom-selectors-css-lite | 120 | 2.286 | 2.191 | 2.815 |
| signature-result-key | 500 | 0.026 | 0.02 | 0.036 |
| signature-fetch-key | 500 | 0.007 | 0.005 | 0.008 |
