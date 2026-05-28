# Auditoria v21.12.11 — Mobile safe payload views

## Objetivo

Reduzir risco de payload pesado e tela lenta no APK/Web após a inclusão dos contratos `appPayload`, `appRenderContract`, `appDataContract`, `appSyncEnvelope`, `appMobileSnapshot` e `appResponseIntegrity`.

## Correções aplicadas

- `view=compact` agora é realmente compacto para mobile/listas/cards.
- Novos aliases públicos: `mobile`, `snapshot`, `sync`, `watchlist` e `list`.
- `appMobileSnapshot` passa a ser a raiz preferencial para primeira pintura quando o view é compacto.
- `appSyncEnvelope` é preservado para decisão de cache/snapshot local.
- `appResponseIntegrity` é reduzido a resumo seguro, com no máximo 5 issues principais.
- `chartSeries`, `chartReadiness`, `panelReadiness`, `consumerDiagnostics`, `appRenderContract`, `appDataContract`, `dividendStats` e `performance` são removidos do compact para evitar tráfego excessivo.
- `appPayload.charts.series` vira `seriesPreview`, com até 3 séries e até 12 pontos recentes por série.
- `payloadViewProfile` informa redução aproximada, raízes removidas e instrução de primeira pintura.

## Contrato recomendado para o APK

- Watchlist/cards/listas: usar `/api/asset?ticker=XXXX&view=mobile` ou `view=snapshot`.
- Tela detalhada: usar `view=full`.
- Portfólio e comparações intermediárias: usar `view=watchlist` ou `view=standard`.
- Para primeira pintura, consumir `appMobileSnapshot`.
- Para atualização segura de cache local, consumir `appSyncEnvelope.decision`.

## Validação

Adicionado teste `test/app-mobile-view-contract-v21-12-11.test.js`, cobrindo:

- aliases de view;
- redução de payload;
- preservação de snapshot/sync;
- remoção de roots pesadas no compact;
- preview reduzido de gráficos;
- remoção de diagnósticos pesados no `standard` quando `includeQuality=false`.
