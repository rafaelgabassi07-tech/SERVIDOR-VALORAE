# Checkpoint v277 — Auditoria Regiões/Negócios no modal de ação

Patch: `21.12.306-stock-revenue-seo-hidden-v277`  
Data: 2026-07-06

## Motivo identificado

O modal de FII funcionava porque seus dados equivalentes estavam chegando em texto/arrays normais. No modal de ação, a página do Investidor10 pode renderizar Regiões/Negócios como imagem no corpo visível e deixar os valores em metadados, atributos ou conteúdo indexável. O parser antigo analisava principalmente o texto visível e por isso ficava vazio.

## Correções

- Extração adicional de `content`, `alt`, `title`, `aria-label` e `data-*` quando contêm Regiões/Negócios ou pares `R$ + %`.
- Extração limitada de fragmentos de scripts quando contêm marcadores de receita.
- Parser textual aceita separador pontuado entre valor monetário e percentual.
- Separação flexível entre seção de Regiões e seção de Negócios em textos SEO compactos.
- Nenhum fallback estático por ticker foi introduzido.

## Validação

- `node test/stock-modal-revenue-seo-hidden-v277.test.js`
- `npm run build`
- `npm run check:syntax`
- `npm test`
- `node scripts/audit-version-consistency.js`
- `node scripts/audit-version.js`
