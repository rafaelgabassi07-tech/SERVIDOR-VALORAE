# Benchmark scraping VALORAE

Gerado em 2026-05-28T14:45:22.392Z. Rede: mocked/local-only.

| Caso | loops | média ms | mediana ms | p95 ms |
|---|---:|---:|---:|---:|
| fast-selectors-single-pass | 120 | 1.704 | 1.456 | 2.568 |
| custom-selectors-css-lite | 120 | 2.495 | 2.371 | 3.442 |
| signature-result-key | 500 | 0.032 | 0.021 | 0.039 |
| signature-fetch-key | 500 | 0.009 | 0.005 | 0.01 |
