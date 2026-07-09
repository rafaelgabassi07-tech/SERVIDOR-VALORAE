# Proxy v298 — Portfolio intraday full coverage

Correção focada no gráfico **Preço da carteira** em 1D/tempo real.

## Problemas corrigidos

- O histórico intradiário podia emitir timestamps em que apenas parte dos ativos já tinha candle disponível, gerando um primeiro ponto artificialmente baixo.
- O último ponto vivo podia ser anexado em base diferente da série Yahoo consolidada, criando queda/salto visual no fim do gráfico.

## Ajustes

- `buildMergedPortfolioSeries` agora calcula a quantidade esperada de ativos com posição positiva em cada timestamp e pula o ponto quando a cobertura está incompleta.
- `alignIntradaySeriesToCurrentPortfolioValue` alinha séries intradiárias ao `currentPrice` enviado pelo APK quando a diferença é pequena e plausível.
- Adicionados testes específicos para cobertura completa intradiária e alinhamento vivo.

## Validação

- `node test/portfolio-history-intraday-full-coverage-v298.test.js`
- `node test/portfolio-history-intraday-live-alignment-v298.test.js`
- `npm run verify`
