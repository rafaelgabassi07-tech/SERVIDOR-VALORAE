# VALORAE Proxy — modal runtime freshness v267

Core: `21.12.0`  
Patch: `21.12.296-modal-runtime-freshness-v267`

Rodada incremental para os modais de Ação e FII. O runtime compartilhado preserva cache curto para performance, mas deixa de devolver cache stale diretamente: após o TTL fresco, o Proxy tenta renovar a fonte real e só usa `STALE_FALLBACK` quando a renovação falha.

## Validação esperada

- `npm run build`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`

## Política mantida

Sem fallback PETR4/GGRC11, sem mock em produção e com produtores de Ação e FII separados.
