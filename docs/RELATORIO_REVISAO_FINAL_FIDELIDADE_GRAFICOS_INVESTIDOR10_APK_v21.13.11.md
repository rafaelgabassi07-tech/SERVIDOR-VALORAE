# Revisão final de fidelidade dos gráficos Investidor10 para APK

Versão técnica: v21.13.11  
Escopo: confirmar se o contrato mobile do Valorae Proxy entrega ao APK os blocos de gráficos e tabelas que aparecem nas páginas públicas do Investidor10 para ações e FIIs de diferentes perfis.

## Páginas revisadas

Foram usadas páginas reais do Investidor10 como referência funcional de fidelidade:

- Ação bancária: BBAS3.
- FII de tijolo/logística: HGLG11.
- FII de papel: KNCR11.
- FII de tijolo com segmento híbrido: KNRI11.
- FII de papel com segmento híbrido: MXRF11.
- FII de tijolo com segmento híbrido e lista de imóveis: GALG11.

## Blocos confirmados para ações

Para ações, a página do Investidor10 pode expor:

- Rentabilidade e rentabilidade real por períodos.
- Receitas e lucros.
- Lucro x cotação.
- Resultados históricos.
- Evolução patrimonial.
- Payout.
- Histórico de dividendos e Dividend Yield.
- Histórico de indicadores, incluindo indicadores específicos por setor quando existentes.
- Quebras por segmento e geografia quando o ativo expõe esses dados.

## Blocos confirmados para FIIs

Para FIIs, as páginas podem expor:

- Cotação e rentabilidade.
- Informações do fundo.
- Histórico de indicadores.
- Comparação com índices e médias do tipo/segmento.
- Distribuições dos últimos 12 meses.
- Dividend Yield e histórico de dividendos.
- Lista de imóveis, quando o fundo possui imóveis físicos informados.
- Informações patrimoniais.
- Distribuição de ativos do fundo, especialmente em FIIs de papel ou híbridos sem lista física de imóveis.

## Lacunas encontradas nesta revisão

A revisão final encontrou três pontos que poderiam prejudicar a fidelidade no APK:

1. Histórico de indicadores em matriz transposta
   - Algumas origens podem retornar indicadores por ano/coluna em matriz simples.
   - O APK espera `colunas` e `linhas` com `{ indicador, valores }`.
   - Foi adicionado normalizador para converter matrizes por período, matrizes por indicador e objetos por ano para o formato do APK.

2. Quebras de receita por geografia/segmento
   - O APK renderiza esses gráficos como mapa por ano contendo entradas com `value`.
   - Algumas origens podem retornar arrays ou pares `labels/series`.
   - Foi adicionado normalizador para converter arrays, mapas e estruturas `labels/series` para o formato consumido pelo APK.

3. FIIs de papel/híbridos sem imóveis físicos
   - Alguns FIIs não têm uma lista física de imóveis, mas expõem distribuição de ativos do fundo.
   - Foi adicionado suporte canônico para `fiiAssetDistribution` e saída mobile `distribuicao_ativos_fundo`.
   - Quando não há lista de imóveis físicos, o contrato também fornece essa distribuição como fallback em `imoveis`, preservando a tela atual do APK sem inventar dados.

## Arquivos alterados

- `lib/compat/mobile-scraper-contract.js`
  - Versão do contrato elevada para `21.13.11-mobile-scraper-investidor10-chart-fidelity`.
  - Normalização robusta de histórico de indicadores.
  - Normalização robusta de quebras por geografia/segmento.
  - Suporte a distribuição de ativos do fundo.
  - Fallback seguro de `imoveis` para distribuição de ativos somente quando lista física não existe.

- `lib/market/investidor10-chart-extractor.js`
  - Detecção do bloco “Distribuição de ativos do fundo”.
  - Mapeamento canônico `fiiAssetDistribution`.
  - Inclusão do bloco na cobertura de gráficos.

- `lib/Valorae-engine.js`
  - Inclusão da distribuição de ativos do fundo no bundle mobile de FIIs.

- `test/mobile-scraper-investidor10-charts-v21-13-10.test.js`
  - Testes adicionais para histórico de indicadores transposto.
  - Testes adicionais para FII de papel/híbrido com distribuição de ativos.
  - Testes adicionais para quebras de receita em arrays e `labels/series`.

- `test/investidor10-complete-asset-charts-v21-12-62.test.js`
  - Teste adicional para captura canônica de distribuição de ativos do fundo.

## Política de fidelidade

O Valorae Proxy não deve fabricar séries para gráficos financeiros. A saída mobile só deve carregar blocos capturados do HTML, JSON embutido ou contrato canônico do ativo. Quando um bloco não existir na página, o contrato deve retornar vazio ou ausente, não simular dados.

A cotação histórica continua fora do contrato `fundamentos` porque o APK já possui fluxo separado para histórico/cotação. Esta revisão não moveu cotação para dentro de `fundamentos` para evitar duplicidade e quebra de contrato.

## Resultado das validações

- `npm test`: 109 arquivos de teste, 0 falhas.
- `npm run check`: 348 arquivos JS checados.
- `npm run typecheck`: contrato SDK OK.
- `npm run audit:identity`: 0 ocorrências externas.
- `npm run smoke`: OK.
