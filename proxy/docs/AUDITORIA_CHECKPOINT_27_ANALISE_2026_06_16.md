# Auditoria Checkpoint 27 — Página Análise

Data: 2026-06-16

## Base auditada
- APK: `apk_valorae_checkpoint_26_secoes_reais_graficos_analise_2026_06_15.zip`
- Proxy: `valorae_proxy_21_12_105_secoes_reais_graficos_analise_2026_06_15.zip`
- Endpoint oficial: `/api/v1/analysis`
- Contrato oficial: `AnalysisPageResponse`
- Versão do contrato: `26.analysis.v2`

## Resultado da auditoria no APK
- `AnalysisScreen.kt` continua chamando `ValoraeProxyClient.getAnalysisPage()`.
- `ValoraeProxyClient.getAnalysisPage()` continua usando somente `/api/v1/analysis`.
- A tela Análise não voltou a usar `quoteOverview`, `assetSummary`, `assetAnalysisPage`, `appPayload.assetAnalysisPage` ou `appMobileSnapshot.assetAnalysisPage`.
- O parser Android agora protege a tela contra inconsistência de status: seção com `items` ou `charts` passa a ser tratada como `ready`.
- `missingSignals` agora é saneado para remover qualquer sinalização de seção que já tenha dados reais.

## Resultado da auditoria no Proxy
- `/api/v1/analysis` continua roteado para `buildAnalysisPageResponse()`.
- `AnalysisPageResponse` continua sem HTML bruto, iframe, imagem do site ou dados sintéticos.
- Adicionado teste regressivo cobrindo PETR4, BBAS3 e HGLG11 com payloads representativos.
- Regra validada: `missingSignals` deve refletir somente seções sem `items` e sem `charts`.

## Observação sobre teste vivo
No ambiente local de empacotamento, chamadas externas a StatusInvest/Investidor10/Yahoo podem expirar. Por isso a auditoria regressiva foi feita no contrato e no fluxo APK ↔ Proxy. Em ambiente implantado com internet, validar novamente:

- `/api/v1/analysis?ticker=PETR4`
- `/api/v1/analysis?ticker=BBAS3`
- `/api/v1/analysis?ticker=HGLG11`

A regra de aceite é: se uma seção retornar `items` ou `charts`, ela deve aparecer no APK e não pode entrar em `missingSignals`.

## Status
Checkpoint 27 concluído como auditoria e proteção contra regressão do contrato único. Próximo checkpoint recomendado: Checkpoint 28 — Gráficos reais da Análise.
