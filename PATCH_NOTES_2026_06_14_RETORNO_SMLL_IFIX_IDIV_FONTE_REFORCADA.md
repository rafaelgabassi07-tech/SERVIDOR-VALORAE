# PATCH NOTES — 2026-06-14 — RETORNO_SMLL_IFIX_IDIV_FONTE_REFORCADA

## Objetivo
Restaurar **SMLL**, **IFIX** e **IDIV** no gráfico do modal **Retorno** quando uma fonte isolada não fornece histórico suficiente.

## Ajuste de fonte
A informação do pacote de referência mostrou que o caminho usado para índices como IBOV/IFIX é o Yahoo Finance chart API:

- IBOV → `^BVSP`
- IFIX → `IFIX.SA`

A partir disso, o Proxy passa a usar a seguinte cadeia para índices do Retorno:

1. B3 oficial `indexStatisticsPage/daily-evolution`
2. Símbolo direto do índice no Yahoo Finance
   - IBOV → `^BVSP`
   - IFIX → `IFIX.SA`, com tentativa secundária `^IFIX`
   - SMLL → `SMLL.SA`, com tentativa secundária `^SMLL`
   - IDIV → `IDIV.SA`, com tentativa secundária `^IDIV`
3. Página de índice do Investidor10 como fallback textual/HTML quando B3/Yahoo não retornarem pontos parseáveis

## Integridade
- Não usa ETF.
- Não usa proxyTicker.
- Não usa ticker negociável como substituto.
- Não inventa série nem preenche valor simulado.
- O gráfico só desenha linha quando há série real no contrato.

## APK
- O APK mantém o contrato atual do modal Retorno.
- O gráfico continua preparado para exibir CDI, IPCA, IBOV, SMLL, IFIX, IDIV e IVVB11.
- Nenhuma mudança destrutiva em Agenda, Proventos, Equilíbrio ou demais modais.

## Versão
- Version Code mantido: 26061314
- Version Name mantido: 2026.06.13.3
