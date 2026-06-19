# VALORAE Proxy — Checkpoint v83

Patch: `21.12.146-analysis-comparison-visual-v83`

## Foco

Suporte contratual leve aos aprimoramentos visuais do comparador setorial da Análise.

- `/api/v1/assets?peerOf=PETR4&max=10` continua retornando apenas pares do mesmo grupo comparável.
- Sugestões setoriais agora carregam metadados visuais como `displayLabel`, `visualGroupLabel` e `uiRole=sector_peer_card`.
- Resposta geral inclui `uiPolicy` e `visualHints` para orientar cards, estado vazio e aviso de comparação manual.
- Mantidos `strictSameSector=true`, `sector`, `segment`, `peerGroup` e `compatibility`.
- Nenhum preço, variação ou recomendação é simulado pelo catálogo de sugestões.
