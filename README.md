## Release 21.12.326

21.12.326-full-modal-portfolio-history-alignment-v297: remove o retorno progressivo/PARTIAL por deadline dos modais de Ação/FII, força contrato full-only e alinha o histórico de carteira às transações completas para evitar divergência e salto artificial no ponto vivo.

## Release 21.12.325

21.12.325-asset-modal-quality-cache-v296: adiciona quality gate aos modais de Ação/FII, impede cache de payload PARTIAL vazio e deixa o cache HTTP desses endpoints em no-store para eliminar intermitência de modal sem dados.

# VALORAE Proxy

## Release 21.12.324

21.12.324-modal-deadline-disable-external-v295: adiciona deadline defensivo aos modais de ação/FII, retorna payload parcial em timeout e faz Yahoo respeitar VALORAE_DISABLE_EXTERNAL sem chamadas externas.


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
