# Proxy VALORAE 21.12.404 — compatibilidade APK v640

Data: 2026-08-09  
APK pareado: `2026.08.09.03`

## Alteração funcional

O endpoint existente `GET /api/v1/analysis/rankings` foi ampliado de forma retrocompatível para reconhecer nove novos IDs de rankings de ações. Não foi criada uma rota paralela.

O contrato semântico de rankings evolui para `21.12.404-analysis-rankings-semantic-v2`. O catálogo passa de 10 para 19 definições e mantém todas as definições anteriores.

Novos campos normalizados: `revenue`, `netIncome`, `cash`, `variation30d`, `profitGrowth5y` e `revenueGrowth5y`, com seus respectivos campos de apresentação.

## Fontes adicionadas

- `https://investidor10.com.br/acoes/rankings/maiores-receitas/`
- `https://investidor10.com.br/acoes/rankings/maiores-lucros/`
- `https://investidor10.com.br/acoes/rankings/maiores-roes/`
- `https://investidor10.com.br/acoes/rankings/menores-pls/`
- `https://investidor10.com.br/acoes/rankings/maiores-altas-30-dias/`
- `https://investidor10.com.br/acoes/rankings/maiores-altas-12-meses/`
- `https://investidor10.com.br/acoes/rankings/maiores-caixas/`
- `https://investidor10.com.br/acoes/rankings/maiores-crescimento-lucro/`
- `https://investidor10.com.br/acoes/rankings/maiores-crescimento-receita/`

## Compatibilidade

- `2026.08.09.03`: `PAIRED`
- `2026.08.09.02`: `SUPPORTED`
- versão acima de `2026.08.09.03`: permanece sujeita à política existente de future-untested.

A versão pública do Proxy permanece `21.12.404`.

## Resultado final da validação

- teste semântico dos 9 rankings: **aprovado**, incluindo correspondência exata das 9 URLs da fonte.
- compatibilidade APK v640: **aprovada**.
- `audit-version-consistency.js`: **aprovado**.
- `audit-version.js`: **aprovado**.
- `npm run build`: **aprovado**.
- `npm run check:syntax`: **437 arquivos JS aprovados**.
- suíte completa: **281 arquivos de teste; 177 aprovados; 100 bloqueados por dependências opcionais; 4 falhas históricas**, sem regressão nova em relação à v639.
