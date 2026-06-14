# PATCH NOTES — 2026-06-14 — RETORNO_IBOV_IFIX_DIRETO_INDICE

## Objetivo
Restaurar IBOV e IFIX no modal **Retorno** quando a consulta oficial da B3 não entregar dados parseáveis no momento, sem recorrer a ETF, ticker substituto, proxyTicker ou valor simulado.

## Correção aplicada no Proxy

### Cadeia de sincronização dos índices
Para IBOV, IFIX, SMLL e IDIV, a nova ordem é:

1. B3 oficial `indexStatisticsPage/daily-evolution`.
2. Fallback controlado para símbolo direto do índice no Yahoo Finance quando a B3 estiver indisponível ou sem pontos parseáveis.

Mapeamento direto utilizado:

- IBOV → `^BVSP`
- IFIX → `IFIX.SA`
- SMLL → `SMLL.SA`
- IDIV → `IDIV.SA`

Esses símbolos são usados como **código direto do índice no provedor de histórico**, não como ETF/proxy/ativo substituto.

## Correção aplicada no APK

- Changelog atualizado para registrar a correção de IBOV/IFIX.
- O modal Retorno permanece compatível com os campos já existentes:
  - `ibovReturnPercent`
  - `ifixReturnPercent`
  - `smal11ReturnPercent`
  - `idivReturnPercent`
  - `ivvb11ReturnPercent`

## Compatibilidade

- Sem alteração de Version Code.
- Sem alteração de Version Name.
- Sem mudança destrutiva em Agenda, Proventos, Equilíbrio, Ranking, Notícias ou Sync.
