# Proxy checkpoint 354 / v322 — Chegada tardia resiliente nos modais

**Versão pública:** `21.12.354`  
**Patch:** `21.12.354-asset-modal-late-arrival-settlement-v322`  
**APK pareado:** v501 / `2026.07.12.03`

## Diagnóstico

Uma resposta full podia satisfazer o conjunto crítico e ser marcada como final enquanto uma seção opcional lenta ainda estava vazia. O APK interrompia a recuperação. Na abertura seguinte, caches de fonte aquecidos entregavam o bloco, fazendo parecer que fechar e reabrir era obrigatório.

Dois atalhos mantinham a falha:

- o cache do Proxy considerava `completeForDelivery` uma melhoria mesmo quando era exatamente o mesmo payload;
- os targets de recovery filtravam as lacunas opcionais e voltavam ao conjunto crítico.

## Alterações

- Delivery v3 estendido com `settlementPending`, `settlementSections` e `settlementAttemptAfterMs`.
- `isFinal` continua representando usabilidade crítica, não completude absoluta.
- `recoveryCacheUpgrade` exige melhoria observável ou resolução de seção conhecida.
- `knownMissingSections` prevalece sobre `requiredSections` ao direcionar um recovery.
- Ações aceitam recuperação de cotação, gráfico, métricas, checklist, dividendos, pares, empresa, receitas, posição acionária, demonstrativos e rentabilidade.
- FIIs aceitam recuperação de cotação, gráfico, métricas, pares, checklist, distribuições, gráficos de dividendos, fundo, imóveis, vacância, informações e rentabilidade.
- Requisitos críticos de Ação/FII permanecem imutáveis.

## Teste de regressão

`asset-modal-late-arrival-settlement-v322.test.js` cria contratos finais com uma seção opcional ausente, grava-os no cache e executa recovery com producer atrasado. O teste cobre Ação (`peerComparison`) e FII (`vacancyHistory`) e confirma:

1. o cache idêntico não é aceito como upgrade;
2. o producer é executado;
3. a seção aparece na mesma sessão;
4. o settlement termina;
5. nenhuma seção opcional vira crítica.
