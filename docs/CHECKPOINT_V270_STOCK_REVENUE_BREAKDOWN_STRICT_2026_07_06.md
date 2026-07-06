# Checkpoint v270 — Receita por região e negócio estrita

## Objetivo
Auditar e corrigir os gráficos de "Regiões onde gera receita" e "Negócios que geram receita" no modal de ação para impedir que campos fundamentalistas, metadata de mercado ou dados da seção "Informações sobre a empresa" sejam tratados como distribuição de receita.

## Correções
- Contrato de ação elevado para `26.asset-modal.stock.v49`.
- `buildStockRevenueBreakdownPayload` agora aplica filtro estrito de labels de receita.
- Chaves como `is_active`, `tag_along`, `free_float`, `variation_30_days`, `gross_margin`, `p_l`, `ev_ebitda` e `ebitda_margin` são descartadas.
- Fontes REST dedicadas de região e negócio não são misturadas.
- Sem fallback estático; sem PETR4/CRFB3/AURE3/GGRC11 de exemplo.

## Validação
- `node test/stock-modal-revenue-breakdown-strict-v270.test.js`
- `node test/stock-modal-revenue-business-i10-v251.test.js`
- `node test/stock-modal-revenue-region-i10-v250.test.js`
- `node test/stock-modal-revenue-breakdown-rest-i10-v260.test.js`
- `npm test`
- `npm run check:syntax`
- `npm run audit:version`
