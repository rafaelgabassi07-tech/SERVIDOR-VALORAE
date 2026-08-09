# Checkpoint Proxy v266 — Auditoria e polimento dos modais

Patch: `21.12.295-modal-audit-polish-v266`  
Contratos: `26.asset-modal.stock.v46 / 26.asset-modal.fii.v22 / 26.asset-modal.runtime.v2`

## Auditoria executada
- Conferência de rotas dedicadas de Ação e FII no roteador e manifesto público.
- Conferência do runtime compartilhado dos modais.
- Conferência de duplicidade/código morto simples em leitura de query/body.

## Correções
- `routeManifest()` agora lista `/asset/fii-modal` e `/fii/modal`, além das rotas de ação já existentes.
- `bodyOrQuery()` remove a condição GET duplicada.
- `ASSET_MODAL_RUNTIME_VERSION` atualizado para `26.asset-modal.runtime.v2`.
- Teste `modal-route-manifest-v266` protege as rotas públicas de modal.

## Política de dados
Sem fallback PETR4/GGRC11, sem mock e sem dado simulado.
