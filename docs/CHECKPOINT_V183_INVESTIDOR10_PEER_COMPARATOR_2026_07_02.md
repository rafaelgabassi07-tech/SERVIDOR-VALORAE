# Checkpoint v183 — Investidor10 peer comparator

## Objetivo

Implementar no Proxy o comparador de fundamentos encontrado na página do ativo no Investidor10, usando o ativo principal, médias de setor/subsetor/segmento e empresas relacionadas do mesmo segmento.

## Contrato novo

- `peerFundamentalComparator`
- `relatedCompanies`
- `comparativeGroups`
- seção `peer_fundamental_comparator` no `AnalysisPageResponse`

## Regras de destaque

- Múltiplos como P/L, P/VP, EV/EBITDA e dívida: menor valor vence.
- Dividend Yield, ROE, ROIC, ROA, margens e CAGR: maior valor vence.
- Métricas sem valor real suficiente ficam fora da seção.

## Validação

- Teste novo: `test/analysis-peer-fundamental-comparator-v183.test.js`.
- Contrato de modais atualizado em `analysis-surface-contract.js`.
