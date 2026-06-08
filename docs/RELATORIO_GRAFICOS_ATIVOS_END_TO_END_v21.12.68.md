# RELATÓRIO — Gráficos de Ativos End-to-End v21.12.70

## Objetivo
Corrigir o fluxo completo dos gráficos das telas de Detalhes do Ativo e Análise no VALORAE, tratando a origem dos dados no Investidor10, o contrato do Proxy e o consumo pelo APK.

## Correções principais no Proxy
- Endurecido `lib/market/investidor10-chart-extractor.js` para extrair histórico de dividendos diretamente do HTML das páginas de ativo quando APIs internas dinâmicas não expõem séries.
- Adicionados aliases canônicos para `dividendHistory`, `dividendMonthly`, `dividendYearly` e `dividendYieldHistory`.
- Preservados valores com até 8 casas decimais em proventos, como `0,35048636`.
- Adicionada classificação de eventos `confirmado`, `provisionado` e `anunciado` quando a data de pagamento está ausente ou provisionada.
- `lib/Valorae-engine.js` agora expõe esses dados também em `historicoDividendos`, `dividendos.historico`, `dividendos.monthly`, `dividendos.yearly`, `sections.dividendos` e `assetChartsCanonical`.
- Mantida compatibilidade com o núcleo `Valorae-engine.js` sem desmembrar o arquivo.

## Evidências
- Simulação PETR4 com linhas reais de tabela `Tipo / Data Com / Pagamento / Valor` gerou eventos, mensal, anual e DY estimado por preço atual.
- O valor `0,35048636` permanece como `0.35048636`, sem truncamento indevido.
- `npm test -- --runInBand` executou 91 arquivos com 0 falhas.

## Limites conhecidos
- Séries como comparação com índices, lucro x cotação, DRE e balanço continuam priorizando APIs internas/JSON embutido do Investidor10. Quando o HTML não contém pontos numéricos suficientes, o Proxy informa cobertura parcial em vez de fabricar série.
