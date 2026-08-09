# Compatibilidade APK v626 — reparo da fonte da Agenda

Data: 2026-08-08

- APK pareado: `2026.08.08.04` / v626.
- Proxy público: `21.12.404`.
- Endpoint preservado: `POST /api/v1/dividends/batch`.
- Esquema financeiro preservado.

## Regressão corrigida

O fallback HTML de proventos usava rotas públicas antigas (`/acao/{ticker}` e `/fii/{ticker}`) e procurava apenas o JSON embutido `assetEarningsModels`. A fonte pública atual expõe ações em `/acoes/{ticker}` e FIIs em `/fundos-imobiliarios/{ticker}`, mantendo a tabela visível `Tipo | DATA COM | Pagamento | Valor`.

A recuperação `home-agenda-recovery-v2` passa a priorizar essas páginas públicas, interpreta a tabela visível e conserva o endpoint JSON interno/JSON embutido como contingência. A chave `source` versionada impede reutilização do cache degradado da v625. Ativos com posição positiva são processados antes do universo histórico para que o deadline favoreça a carteira atual.
