# VALORAE Proxy — stock modal data integrity v268

Core: `21.12.0`  
Patch: `21.12.297-stock-modal-data-integrity-v268`

Rodada incremental para corrigir três pontos do modal de ação: posição acionária estrita no escopo correto do Investidor10, histórico de indicadores fundamentalistas com aliases/endpoints adicionais e diagnósticos mais claros quando linhas são descartadas por ruído.

## Validação esperada

- `npm run build`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

## Política mantida

Sem fallback PETR4/GGRC11, sem mock em produção e com produtores de Ação e FII separados.
