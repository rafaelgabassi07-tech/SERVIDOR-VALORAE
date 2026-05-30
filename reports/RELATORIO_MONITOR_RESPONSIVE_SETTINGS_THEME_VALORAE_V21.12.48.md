# Auditoria Monitor Responsive Settings Theme — VALORAE v21.12.48

Entrega: `21.12.48-monitor-responsive-settings-theme`.

## Escopo

Auditoria e correções no Monitor do Proxy com foco em:

- filtros da página **Saída do Proxy** que ficavam cortados;
- adaptação automática mobile/tablet/desktop;
- página dedicada de configurações;
- suporte a modo claro e escuro;
- botão de tema no cabeçalho;
- aprimoramento dos ícones do menu lateral.

## Correções aplicadas

1. Os filtros `Status HTTP`, `Raiz do payload` e `Mais recentes` agora usam dropdown flutuante com `position: fixed`, cálculo de largura/top/left pelo viewport e opções com quebra de linha.
2. A toolbar da Saída do Proxy foi reforçada para não cortar menus e para ocupar largura total no mobile.
3. Foi criada a página **Configurações** com tema, origem da API, estado do polling e diagnóstico de responsividade.
4. Foi adicionado botão **Tema** no cabeçalho direito, alternando claro/escuro e salvando em `localStorage`.
5. Foi adicionado modo claro com variáveis CSS próprias, canvas/pre/cards ajustados e `theme-color` dinâmico.
6. O menu lateral passou a usar ícones SVG lineares em vez dos símbolos simples anteriores.
7. A release foi sincronizada para `21.12.48-monitor-responsive-settings-theme`.

## Verificações de responsividade

- Desktop: sidebar fixa, grades multi-coluna e dropdowns protegidos pelo viewport.
- Tablet: drawer lateral, grades colapsadas quando necessário e cards mantendo leitura.
- Mobile: filtros em largura total, menu lateral por drawer, cards com padding reduzido e dropdowns ocupando `calc(100vw - 20px)`.

## Testes executados

- `npm run check`
- `npm test`
- `npm run build`
- `npm run build:strict`
- `npm run typecheck`
- `npm run smoke`
- `npm run audit:complete-polish`
- `npm run audit:visual-polish`
- `npm run audit:engine-core`
- `npm run audit:engine-modules`
- `npm run audit:engine-performance`
- `npm run bench:scrape`
- `npm run bench:turbo`
- `npm run bench:stale-budget`
- `npm run bench:canonical`
- `npm audit --omit=dev`

## Resultado

A versão está aprovada para uso pessoal. A correção é visual/operacional e não remove dados, gráficos, rankings, dividendos, Investidor10, StatusInvest nem a camada canônica.
