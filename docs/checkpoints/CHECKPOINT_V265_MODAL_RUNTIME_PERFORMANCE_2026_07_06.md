# Checkpoint Proxy v265 — Modal runtime performance

Patch: `21.12.294-modal-runtime-performance-v265`  
Contratos: `26.asset-modal.stock.v46` e `26.asset-modal.fii.v22`

## Alterações

- Runtime compartilhado dos modais em `lib/analysis/asset-modal-runtime.js`.
- Cache curto e coalescing por família/ticker/superfície para evitar recomputação simultânea do mesmo modal.
- Modal de Ação mantém produtor próprio, com comparação de índices e blocos auxiliares iniciados em paralelo.
- Modal de FII mantém produtor próprio, com histórico, vacância e comunicados iniciados em paralelo depois do HTML base.
- Nenhum fallback fixo PETR4/GGRC11 foi introduzido.

## Validação esperada

- `node --check` nos arquivos alterados.
- `npm run check:syntax`.
- Testes de contratos dos modais e auditoria de versão.
