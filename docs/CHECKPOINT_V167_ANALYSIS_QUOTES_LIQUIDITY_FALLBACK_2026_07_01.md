# Checkpoint Proxy v167 — Quotes com fallback de fundamentos e liquidez

Refina /api/v1/quotes para reduzir campos vazios de P/VP, DY, cotação e liquidez nas subpáginas da Análise, extraindo liquidez do snapshot Fundamentus e estimando valor negociado via volume quando necessário.

## Ajustes
- Snapshot Fundamentus passa a mapear aliases adicionais de P/VP/PVPA, DY, cotação e liquidez média diária.
- Parser de FIIs e ações aceita colunas como Liq.2meses, Liquidez Média Diária, Liq. Diária e Volume Médio.
- Quotes do Yahoo preservam volume negociado e o contrato estima liquidez quando a fonte de fundamentos não entrega liquidez explícita.
- Mantida compatibilidade com assets, quotes, items e results do contrato do APK.
