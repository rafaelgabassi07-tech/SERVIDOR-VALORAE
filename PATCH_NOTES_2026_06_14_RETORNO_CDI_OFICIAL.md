# Retorno: CDI oficial Banco Central

- Adicionado provedor robusto de CDI oficial em `lib/sources/cdi.js`.
- Fonte primária: Banco Central SGS 12, CDI diário.
- Fonte fallback oficial: Banco Central SGS 4391, CDI acumulado no mês.
- Removida qualquer possibilidade de benchmark CDI simulado, ticker, ETF ou proxy de mercado.
- O contrato `/api/v1/portfolio/returns` agora usa o CDI oficial e melhora os diagnósticos quando não houver interseção de meses com a carteira.
- Adicionado teste `test/portfolio-returns-cdi-official.test.js`.
