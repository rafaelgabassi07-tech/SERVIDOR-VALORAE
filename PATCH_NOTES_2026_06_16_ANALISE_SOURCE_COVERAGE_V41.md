# Patch 21.12.125 — Cobertura ampliada das fontes da Análise

Data: 2026-06-16

## Objetivo
Revisar StatusInvest, Investidor10 e a referência referência técnica externa para garantir que a página Análise aproveite melhor as informações realmente disponíveis nas fontes, sem expor termos técnicos ao usuário final e sem criar dados sintéticos.

## Melhorias
- Nova seção `market_context` com faixa de preço, liquidez, volatilidade, tag along/free float/IBOV quando a fonte entregar.
- Nova seção `ownership` para posição acionária de ações, com gráfico de barras horizontais quando houver percentuais reais.
- Nova seção `fii_checklist` para checklist de FIIs quando o Investidor10 fornecer critérios reais.
- Diagnóstico interno `sourceCoverage` para auditar quais blocos esperados da fonte estão implementados ou ausentes.
- DRE/Balanço/Fluxo agora aceitam gráficos em formato `labels/datasets`, arrays nomeados e chaves do padrão referência técnica externa/Investidor10.
- Receita por negócio/região passou a aceitar também embeds e extras internos equivalentes ao padrão `revenue_geography` e `revenue_segment`.

## Restrições mantidas
- Nenhum dado sintético.
- Gráficos históricos exigem pelo menos dois períodos reais.
- Comparadores continuam exigindo séries reais alinhadas.
- Contrato da Análise permanece `/api/v1/analysis` e `AnalysisPageResponse`.
