# 2026-06-16 — Checkpoint 27 — Auditoria real do contrato único da Análise

## Objetivo
Validar e reforçar o caminho único da página **Análise** entre o Proxy e o APK, usando somente `/api/v1/analysis` e o contrato `AnalysisPageResponse`.

## Ajustes realizados
- O APK agora saneia `missingSignals`: qualquer seção que tenha `items` ou `charts` reais deixa de aparecer como pendente, mesmo se o status remoto vier inconsistente.
- O parser Android passa a considerar uma seção como `ready` quando existem itens ou gráficos estruturados.
- O fallback de versão do contrato Android foi alinhado para `26.analysis.v2`.
- O `itemCount` local agora considera `items + charts` quando o Proxy não enviar contagem explícita.
- Adicionado teste regressivo `analysis-contract-audit-v27.test.js` cobrindo PETR4, BBAS3 e HGLG11 em payloads representativos do `AnalysisPageResponse`.

## Regras preservadas
- A página Análise continua consumindo somente `/api/v1/analysis`.
- O APK não recebe HTML bruto nem iframe.
- O Proxy não cria dados, gráficos, índices ou valores sintéticos.
- Rotas antigas usadas por outros modais permanecem preservadas.
