# Checkpoint 370 — Source adapter isolation v338

Este checkpoint introduz uma fronteira comum para os provedores sem substituir seus extratores atuais.

## Garantias

- Contratos financeiros e valores permanecem inalterados.
- Cada adaptador pode ser desativado por fonte ou operação.
- Métricas são internas e consultáveis pelo manifesto.
- Baseline e observabilidade permanecem ativos.
- APK v518 negocia `isolated-provider-adapters-v1`.

## Adaptadores

- Yahoo: history, quote, logo.
- Investidor10: directIndexHistory, rankings.
- StatusInvest: confirmedDividends.
- B3: indexHistory.
- BCB: series, ipcaMarket, cdi, ipca.

## Validação

- 428 arquivos JavaScript verificados.
- 221 arquivos de teste aprovados.
- 27 testes APK↔Proxy aprovados.
- Build Vercel e auditoria de versão aprovados.
