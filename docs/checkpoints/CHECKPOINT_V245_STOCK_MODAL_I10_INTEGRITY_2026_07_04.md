# Checkpoint v245 — Integridade do modal de ações via Investidor10

Proxy: `21.12.274-stock-modal-i10-integrity-v245`
Contrato: `26.asset-modal.stock.v26`
APK pareado: `v364`

## Escopo

Auditoria e correção conjunta das três áreas reportadas no modal único de ação:

1. Gráfico de Payout
2. Histórico de Indicadores Fundamentalistas
3. Checklist Buy and Hold

## Correções

### Payout

- Normalização de unidades explícitas do Investidor10 (`Bilhões`, `Milhões`, `B`, `M`, `BI`, `MI`) em séries dedicadas.
- Correção para impedir que ausência de lucro líquido vire zero.
- Correção para impedir reaproveitamento automático de lucro anual em `Últ 12M` quando a fonte real não entrega o dado.
- Preservação dos displays reais por ponto: lucro líquido, payout e dividend yield.

### Histórico de Indicadores Fundamentalistas

- Leitura combinada de HTML, estruturas canônicas e payloads de API do Investidor10.
- Suporte a `columns/data`, `rows/linhas`, `categories/series`, objetos por indicador e tabelas já normalizadas.
- Mesclagem de 5A e 10A sem sobrescrever valores reais.
- Preservação de percentuais reais em Payout, DY, margens, ROE, ROIC, ROA e CAGR.

### Checklist Buy and Hold

- Captura limitada ao intervalo de cada critério, evitando vazamento do ícone/status de linhas vizinhas.
- Reconhecimento de status positivo/negativo por classes, SVG, ícones e atributos acessíveis do HTML.
- Mantidos os 10 critérios quando o Investidor10 entrega a seção completa.

## Política de dados

- Sem fallback PETR4.
- Sem fallback GGRC11.
- Sem mock em produção.
- Sem dado fabricado.
- Campo ausente permanece `EMPTY`/`UNKNOWN`.

## Testes adicionados

- `test/stock-modal-i10-integrity-v245.test.js`

## Testes executados

- `node --check lib/analysis/stock-modal-contract.js`
- `node test/stock-modal-payout-chart-investidor10-v244.test.js`
- `node test/stock-modal-historical-indicators-investidor10-v243.test.js`
- `node test/stock-modal-contract-v215.test.js`
- `node test/stock-modal-i10-integrity-v245.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`
