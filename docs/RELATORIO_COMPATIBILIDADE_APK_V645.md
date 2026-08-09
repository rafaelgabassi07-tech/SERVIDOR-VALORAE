# Compatibilidade APK v645 × Proxy 21.12.404

## Pareamento

- APK: `2026.08.09.08` / v645
- Proxy: `21.12.404`
- Status: `PAIRED`
- APK v644 (`2026.08.09.07`) permanece `SUPPORTED`.

## Ticker da Análise

O Proxy mantém oito instrumentos canônicos na rota existente `/api/v1/market/indices`: USD, IFIX, IDIV, SMLL, CDI, IPCA, IBOV e IVVB11. O payload continua expondo `indices`, `tickerItems` e `items`, permitindo compatibilidade com clientes novos e antigos. Nenhuma rota pública foi criada ou removida nesta release.

## Alteração funcional do Proxy

Não houve alteração de cálculo, fonte ou parser de mercado nesta release. O APK v645 passou a consumir de forma mais tolerante os contêineres já expostos pelo Proxy e a manter largura física da trilha completa. No Proxy, as mudanças são de pareamento, documentação e testes de compatibilidade.

## Validação

- `npm run build`
- checagem de sintaxe JavaScript
- `npm run audit:version`
- teste `apk-v645-analysis-performance-visual-compatibility.test.js`
- testes de contrato do ticker e compatibilidade histórica

## Resultado regressivo

Comparação usando a mesma suíte do Proxy:

- baseline v644: 286 testes / 182 aprovados / 100 bloqueados por dependências opcionais / 4 falhas históricas;
- v645: 287 testes / 183 aprovados / 100 bloqueados / as mesmas 4 falhas históricas.

As quatro falhas permanecem nos mesmos testes históricos de mapa/artefato/monitor e não foram introduzidas pela v645.
