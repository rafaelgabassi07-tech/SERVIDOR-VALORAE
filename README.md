# VALORAE Proxy — Checkpoint v82

Patch: `21.12.145-analysis-sector-peers-v82`

## Foco

- Reforço do comparador setorial da página Análise do APK.
- `/api/v1/assets?peerOf=PETR4&max=10` continua retornando apenas pares do mesmo grupo comparável.
- `/api/v1/assets?peerOf=PETR4&compareWith=BBAS3` agora também devolve `compatibility`, informando se o par pertence ao mesmo `peerGroup`.
- Respostas de sugestão retornam `strictSameSector: true`, `sector`, `segment`, `peerGroup` e `searchPolicy=analysis_same_sector_suggestions_v82`.
- Catálogo ampliado em petróleo/gás, energia e infraestrutura financeira, sem preço/variação simulados.
