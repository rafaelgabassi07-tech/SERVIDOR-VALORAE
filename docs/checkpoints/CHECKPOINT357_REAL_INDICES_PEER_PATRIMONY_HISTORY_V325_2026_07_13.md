# Checkpoint 357 — Proxy v325

## Objetivo

Garantir que gráficos de índices usem somente histórico temporal real, completar Valor patrimonial no comparador de FIIs e corrigir a qualidade do Histórico de indicadores das ações.

## Barreiras de integridade

`lib/sources/history-integrity.js` rejeita fontes ou pontos marcados como `simulated`, `synthetic`, `proxy ticker`, `snapshot reconstructed` ou equivalentes. Um snapshot isolado não é convertido em curva.

## FIIs comparáveis

As páginas individuais dos pares são consultadas com concorrência e orçamento limitados. O patrimônio total é extraído diretamente; P/VP não é usado para inferência. A seção permanece em settlement enquanto não houver cobertura mínima comparável.

## Histórico de indicadores

A coleta prioriza endpoints dedicados, exige evidência temporal, remove anos futuros, evita duplicar Atual e ano corrente e permite que fontes secundárias apenas preencham lacunas.
