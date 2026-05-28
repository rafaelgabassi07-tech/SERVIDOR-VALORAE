# Auditoria v21.12.12 — Field Alias Normalizer + Mobile Compact Fix

## Objetivo

Aprimorar a leitura de dados financeiros quando fontes públicas, scrapers ou APIs retornam campos com nomes heterogêneos, acentos, abreviações, labels de tela ou padrões PT-BR/EN-US. Também corrigir a resolução de `view=watchlist` e `view=list` para payload compacto real, evitando JSON pesado em listas e primeira pintura do app.

## Melhorias aplicadas

- `lib/normalizers/universal.js`
  - Versão interna: `21.12.12-field-alias-normalizer`.
  - Adiciona varredura defensiva de aliases em `results` até profundidade limitada.
  - Reconhece labels como `Preço`, `D.Y`, `P/VP`, `Último Rendimento`, `Patrimônio Líquido`, `Liquidez Média Diária`, `Vacância Física`, `marketCap`, `lastDividend`, `currentPrice` e similares.
  - Usa o parser financeiro central (`parseFinancialNumber` / `parsePercentNumber`) antes do parser legado.
  - Preserva rastreabilidade em `source`, por exemplo `valorae:alias:indicadores.D.Y`.
  - Marca `_meta.aliasFallbacks = true`.

- `lib/quality/app-consumer-payload.js`
  - Agora o fallback bruto também usa `makeFinancialField`, evitando `Number('R$ 1,10') === NaN` e melhorando métricas canônicas do app.

- `lib/quality/views.js`
  - Corrige `watchlist` e `list` para resolverem como `compact`.
  - Mantém `portfolio/wallet` como `standard` para telas agregadas que precisam de mais dados.

## Impacto no APK/Web

- Menos painéis vazios quando o scraper entrega labels visuais em vez de chaves canônicas.
- Melhor leitura de números brasileiros (`R$ 4,2 bi`, `9,87%`, `R$ 8,5 mi`).
- `view=watchlist` e `view=list` passam a carregar `appMobileSnapshot`/sync compacto sem contratos pesados.
- O app continua podendo hidratar detalhes com `view=full` quando abrir a página do ativo.

## Teste dedicado

- `test/field-alias-mobile-compact-v21-12-12.test.js`

## Validações recomendadas

```bash
npm run check
node test/field-alias-mobile-compact-v21-12-12.test.js
npm test
npm run audit:vercel-api
npm run audit:dashboard-live
npm run audit:live-endpoints
npm run audit:single-app
npm run build
npm run smoke
npm run typecheck
npm run audit:free
```
