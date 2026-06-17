# Relatório — Análise conectada aos modais v57

Data: 2026-06-16  
Checkpoint: `analysis-modals-connected-v57`  
Proxy: `21.12.140-analysis-modals-connected-v57`  
APK: `versionCode = 26061401`, `versionName = 2026.06.14.1`

## Objetivo

Executar a próxima etapa após o v56: conectar de fato os futuros modais dos ativos da carteira e dos ativos mostrados no ranking ao mesmo contrato visual da página Análise, sem duplicar lógica, sem criar uma segunda análise paralela e sem poluir a tela principal com diagnóstico técnico.

## Ajustes no Proxy

1. `/api/v1/analysis` agora aceita seleção de superfície por query:
   - `surface=analysis_page`
   - `surface=portfolio_asset_modal`
   - `surface=ranking_asset_modal`
   - também aceita `consumer`, `consumerId`, `uiSurface` ou `modalSurface`.

2. O `consumerContract` foi promovido para `26.analysis.surface.v2`.

3. O contrato agora informa:
   - `activeSurfaceId`;
   - `activeSurface`;
   - `selected: true` na superfície solicitada;
   - `readySectionIds` por superfície;
   - `uiPolicy` preservando tela limpa e sem dados sintéticos.

4. Adicionado campo top-level `consumerSurface` para facilitar depuração segura por consumidores APK, sem expor detalhes técnicos ao usuário final.

5. Adicionado teste regressivo:
   - `test/analysis-modals-connected-v57.test.js`
   - valida carteira/ranking, superfície ativa, seções prontas e política de UI.

## Ajustes no APK

1. `ValoraeProxyClient.getAnalysisPage()` agora aceita parâmetro opcional `surface`.

2. O cache da Análise foi separado por superfície:
   - página completa;
   - modal de ativo da carteira;
   - modal de ativo do ranking.

3. A tela de início/ranking agora permite tocar em um ativo do ranking para abrir a Análise compacta com `AnalysisSurfaceMode.RankingAssetModal`.

4. O modal “Patrimônio total” ganhou uma seção compacta “Análise dos ativos em carteira”. O usuário toca em um ativo da carteira e abre a Análise compacta com `AnalysisSurfaceMode.PortfolioAssetModal`.

5. Criado `AssetAnalysisBottomSheet`, reutilizando diretamente `AnalysisAssetDetailSurface`.

6. A função `visibleAnalysisSections` foi exposta dentro do pacote para permitir que os modais contem blocos prontos sem duplicar regra.

7. A página principal da Análise continua limpa. Diagnóstico, drift, tecnologias de extração e pendências técnicas seguem fora da UI principal.

## Validações executadas

Proxy:

- `npm run check` OK — 238 arquivos JS checados.
- `npm test` OK — 54 arquivos de teste, 0 falhas.
- `npm run verify` OK.
- `npm run audit:version` OK.
- `npm run audit:identity` OK.
- `npm run smoke` OK.

APK:

- `version.json` OK.
- `update.json` OK.
- `changelog.json` OK.
- `app/src/main/assets/valorae_changelog.json` OK.
- Build Android completo não executado porque o pacote não inclui `gradlew` e o ambiente não possui SDK/Gradle Android.

## Regra de produto preservada

A Análise agora funciona como componente-mãe também para modais, mas mantém a hierarquia visual:

1. mostrar primeiro informações úteis para decisão;
2. deixar dados longos recolhidos/compactos;
3. esconder diagnóstico técnico do usuário final;
4. nunca simular dados quando Investidor10 ou StatusInvest não enviarem informação real.

## Próximo passo recomendado

Depois do v57, a próxima etapa lógica é criar uma validação multiativos automatizada por carteira/ranking, com amostras de ações e FIIs variados, para confirmar na prática quais seções ficam prontas em cada superfície e gerar alerta quando uma fonte mudar HTML ou perder blocos relevantes.
