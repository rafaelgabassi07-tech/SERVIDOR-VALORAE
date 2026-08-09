# Checkpoint v181 — Compatibilidade e fidelidade de gráficos

## Escopo aplicado

- Adicionado contrato explícito de gráficos no `/api/v1/analysis`:
  - `axisKind`: `time` ou `category`.
  - `preserveSourceOrder`: instrui o APK a não reordenar categorias da fonte.
  - `sourceVisualModel`: origem visual/semântica do gráfico.
  - `sourceFidelity`: `exact`, `derived`, `official`, `source` ou `reconstructed`.
- Gráficos reconstruídos por snapshot Yahoo ou rentabilidade mensal são bloqueados antes de chegar ao contrato profissional.
- OpenAPI e manifesto de integração passam a declarar métodos reais por rota, separando GET e POST.
- Criados testes de regressão para contrato visual de gráficos e métodos OpenAPI.

## Validações

- `npm run verify` com 85 arquivos de teste, 0 falhas.
- `scripts/check-syntax.js` com 271 arquivos JS verificados.
