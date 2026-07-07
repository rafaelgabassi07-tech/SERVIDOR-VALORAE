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
