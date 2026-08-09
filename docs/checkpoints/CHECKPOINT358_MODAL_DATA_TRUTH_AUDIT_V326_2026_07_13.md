# Checkpoint 358 — Modal data truth audit v326

## Política

Os contratos de Ação e FII operam em modo `FAIL_CLOSED`: um dado só é apresentado como direto quando existe fonte e evidência para o ticker solicitado. Ausência permanece `EMPTY`, `ERROR` ou `UNKNOWN`.

## Bloqueios

- mock, synthetic e snapshots estáticos;
- ticker substituto;
- uma cotação transformada em histórico;
- curva reconstruída de retornos mensais;
- DY histórico reconstruído com a cotação atual;
- herança de tipo/segmento em FIIs apenas relacionados;
- inferência de valor patrimonial;
- média de segmento sem prova do recorte da fonte.

## Dados calculados identificados

- checklist quando calculado sobre métricas reais;
- ocupação como `100% − vacância` quando a fonte não publica ocupação;
- retorno acumulado, rebasing e simulação de R$ 1.000 sobre séries reais;
- radar de dividendos como projeção estatística do histórico, sem garantia futura;
- lucro x cotação como composição de lucro anual real e cotação anual real.
