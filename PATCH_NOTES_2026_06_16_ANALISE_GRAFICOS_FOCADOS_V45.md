# Patch Notes — 2026-06-16 — Análise gráficos focados v45

Release: `21.12.129-analysis-focused-charts-v45`

## Escopo

Revisão focada nos gráficos da página Análise:

- Lucro x Cotação;
- Negócios e regiões de receitas;
- Balanço por período.

## Correções

- `Lucro x Cotação` agora é entregue ao APK como `multi_line`, preservando duas séries reais alinhadas: cotação em base 100 e lucro em base 100.
- `Negócios e regiões de receitas` passa a respeitar a natureza de composição dos dados capturados dos gráficos da fonte, sem forçar barras horizontais quando o contrato já traz composição/donut.
- `Balanço por período` passou a alinhar as séries por período antes de chegar ao APK, evitando barras visualmente deslocadas quando Ativos, Passivos e Patrimônio Líquido têm períodos diferentes.
- Criado teste regressivo `test/analysis-focused-charts-v45.test.js` cobrindo os três gráficos.

## Política de dados

Nenhum dado foi criado, simulado ou preenchido por aproximação. Se a fonte não entregar série real suficiente, o gráfico permanece ausente/sinalizado.
