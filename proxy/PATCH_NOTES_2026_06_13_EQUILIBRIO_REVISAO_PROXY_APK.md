# Equilíbrio — revisão completa do contrato do Proxy

## Rota revisada

`POST /api/v1/portfolio/equilibrium`

## Correções

- Preserva metadados do cliente, incluindo segmento, setor, tipo de FII, segmento de FII e exposição.
- Evita classificar units conhecidas terminadas em 11 como FII quando não houver classe explícita.
- Mantém Consolidado, Ações e FIIs com charts separados.
- Declara `contractVersion = equilibrium-v2026-06-13.2`.

## Validação esperada

- Consolidado sempre entregue.
- Ações entregue apenas quando houver ações.
- FIIs entregue apenas quando houver FIIs.
- Gráficos por ativo, classe, exposição, segmento, setor, tipo de FII e segmento de FII.
