# RELATÓRIO — ANÁLISE SOURCE WATCH + MODAIS V56

Data: 2026-06-16  
Checkpoint: `analysis-source-watch-modals-v56`  
Proxy: `21.12.139-analysis-source-watch-modals-v56`  
APK: `versionCode = 26061401`, `versionName = 2026.06.14.1`

## Decisão desta etapa

Como o trabalho será feito por partes, esta etapa começou pelo ponto mais estrutural: transformar a página **Análise** em um contrato compartilhado para a tela completa e para os futuros modais de ativos da carteira e dos ativos exibidos no ranking.

O objetivo foi evitar duplicação de lógica e impedir que cada modal passe a ter uma versão diferente da mesma análise.

## Ajustes no Proxy

1. Adicionado contrato `consumerContract` na resposta da Análise.
   - Consumidores previstos:
     - `analysis_page`
     - `portfolio_asset_modal`
     - `ranking_asset_modal`
   - Cada superfície recebe densidade, seções prioritárias e IDs prontos para renderização.

2. Criado contrato de prioridade visual da Análise.
   - Dados essenciais ficam no topo.
   - Dados profundos continuam recolhidos.
   - Diagnósticos técnicos ficam fora da tela principal.

3. Adicionado diagnóstico interno de mudança de HTML da fonte.
   - Novo módulo: `lib/resilience/source-drift.js`
   - O Proxy agora avalia cobertura esperada por fonte:
     - StatusInvest ações
     - StatusInvest FIIs
     - Investidor10 ações
     - Investidor10 FIIs
   - O diagnóstico observa sinais como campos ausentes, baixa cobertura, bloqueio, captcha, Cloudflare, fallback e seletores que pararam de entregar dados.

4. Adicionada integração do `sourceDriftReports` ao pipeline de ativos e à resposta da Análise.
   - O diagnóstico fica em `diagnostics`.
   - O APK não mostra esse ruído técnico ao usuário final.

5. Adicionado suporte a dados de rendimento provisionado de FIIs quando aparecem no HTML real do StatusInvest.
   - `Rendimento provisionado`
   - `Comparação + provisionado`

6. Mantida a política real-only.
   - Sem dados simulados.
   - Sem ticker falso.
   - Sem `eval`.
   - Sem WebView.
   - Sem expor tecnologias internas na tela principal.

## Ajustes no APK

1. Adicionado modelo Kotlin para `ValoraeAnalysisConsumerContract`.
2. O parser do Proxy agora lê `consumerContract`, `modalBlueprint` ou `analysisConsumerContract`.
3. A página Análise passa a usar os IDs de seções prontos por superfície.
4. Criado `AnalysisAssetDetailSurface`, que permite reaproveitar a mesma base visual nos futuros modais de:
   - ativo em carteira;
   - ativo em ranking.
5. A tela principal continua limpa:
   - mostra apenas seções prontas;
   - mantém dados profundos recolhidos;
   - não mostra drift, tecnologias de extração, pendências técnicas ou diagnóstico bruto.

## Testes executados no Proxy

- `npm run check` OK — 237 arquivos JS checados.
- `npm test` OK — 53 arquivos de teste, 0 falhas.
- `npm run verify` OK.
- `npm run audit:version` OK.
- `npm run audit:identity` OK — 0 ocorrências externas.
- `npm run smoke` OK.

## Verificação do APK

- `version.json` válido.
- `update.json` válido.
- `changelog.json` válido.
- `app/src/main/assets/valorae_changelog.json` válido.
- `versionCode` mantido: `26061401`.
- `versionName` mantido: `2026.06.14.1`.

Build Android completo não foi executado porque o pacote não contém `gradlew` e o ambiente não possui SDK/Gradle Android disponível.

## Resultado

A página Análise agora está preparada como base compartilhada para a tela completa e para os futuros modais, sem poluir a experiência do usuário final. O Proxy também passa a ter um mecanismo interno para sinalizar quando o HTML do Investidor10 ou StatusInvest aparentar mudança estrutural.

## Próxima parte recomendada

Executar a parte 2: conectar efetivamente os modais de ativos da carteira e os modais dos ativos do ranking ao `AnalysisAssetDetailSurface`, reaproveitando o contrato `consumerContract` sem duplicar layout nem regra de negócio.
