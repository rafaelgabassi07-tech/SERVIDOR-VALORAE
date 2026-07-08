# VALORAE Proxy

## Release 21.12.321

21.12.321-portfolio-rebuild-v292: reconstrói os motores de Preço da carteira, cotações diárias dos cards e histórico mensal do Patrimônio Total, preservando correções de receita, Lucro x Cotação e filtros de cotação.

# VALORAE Proxy — histórico fundamentalista de ações v274

Core: `21.12.0`  
Patch: `21.12.303-stock-historical-indicators-v274`

Checkpoint v274 reforça o parser do histórico de indicadores fundamentalistas do modal de ação. O contrato passa a aceitar respostas tabulares/indexadas do Investidor10, incluindo formatos DataTables com colunas e linhas numéricas, sem fallback estático.

Validações principais:
- `npm run check:syntax`
- `npm test`
- `node test/stock-modal-historical-indicators-indexed-rows-v274.test.js`
- `node scripts/audit-version-consistency.js`
- `node scripts/audit-version.js`


## Release 21.12.318

21.12.318-quote-history-range-aliases-v289: corrige aliases de período do histórico de cotação para filtros 1D/5D/1M/3M/6M/1A/5A/MÁX e preserva Lucro x Cotação/Regiões/Negócios.

## Release 21.12.317

21.12.317-stock-profit-quote-priority-v288: corrige a normalização do formato Vesto/Investidor10 ano → categoria → { value } para Regiões e Negócios de receita em ações.

## Release 21.12.313

21.12.313-stock-revenue-charts-v284: reforça os gráficos de receita por regiões e negócios no modal de ações.
