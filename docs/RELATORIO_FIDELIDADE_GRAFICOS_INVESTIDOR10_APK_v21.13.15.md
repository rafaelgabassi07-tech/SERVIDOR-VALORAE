# Relatório de fidelidade dos gráficos do Investidor10 para APK — v21.13.15

## Objetivo

Esta rodada focou exclusivamente em fazer o Valorae Proxy entregar ao APK um contrato de gráficos mais fiel ao que aparece nas páginas de ativos do Investidor10, sem criar dados sintéticos e sem depender de uma única estrutura interna de payload.

## Resultado principal

Foi criado e estabilizado o catálogo gráfico `graficos_i10`, acompanhado por `chart_manifest` e `chart_fidelity`.

- `graficos_i10`: lista renderizável de gráficos/blocos visuais do ativo.
- `chart_manifest`: resumo leve para o APK saber o que existe, o que pode ser renderizado e qual campo legado alimenta cada bloco.
- `chart_fidelity`: diagnóstico de cobertura para integração e QA visual.

Aliases compatíveis também foram adicionados:

- `graficosI10`
- `graficos`
- `chartManifest`
- `chartFidelity`

Os campos legados continuam preservados para não quebrar a interface atual.

## Gráficos e blocos agora mapeados

### Blocos gerais

- `cotacao`: área de cotação do ativo, com controles 1D, 7D, 30D, 6M, YTD, 1A, 5A, 10A, 15A e Personalizado.
- `rentabilidade`: rentabilidade nominal e rentabilidade real, separada de comparação com índices.
- `comparacao_indices`: comparação do ativo com índices, com faixas 2A, 5A e 10A.
- `comparacao`: comparação tabular entre ativos semelhantes, separada da comparação com índices.

### Empresas, BDRs e ativos com demonstrativos

- `receitas_lucros`: Receitas e Lucros.
- `lucro_cotacao`: Lucro X Cotação.
- `resultados`: tabela/demonstrativo de resultados.
- `fluxo_caixa`: demonstrativo de fluxo de caixa.
- `evolucao_patrimonio`: evolução patrimonial, ativos e passivos.
- `payout`: payout e dividend yield quando a origem fornece a série.
- `revenue_geography_*`: regiões onde a empresa gera receita.
- `revenue_segment_*`: negócios/segmentos que geram receita.

### FIIs

- `historico_indicadores`: Histórico de Indicadores Fundamentalistas.
- `distribuicoes_12m`: distribuições nos últimos 12 meses.
- `dividend_yield_history`: histórico de dividend yield.
- `dividend_history`: dividendos/rendimentos pagos.
- `lista_imoveis`: lista de imóveis físicos com estado e ABL quando disponível.
- `distribuicao_ativos_fundo`: distribuição de ativos do fundo para FIIs de papel/híbridos.

### ETFs

- `rentabilidade`: histórico de rentabilidade nominal e real.
- `comparacao_indices`: comparação com índices quando a página expõe o bloco.
- `cotacao`: área de cotação, mantendo o fluxo de série histórica separado quando o endpoint de fundamentos não traz todos os pontos.

## Correções de fidelidade feitas nesta rodada

1. Rentabilidade não usa mais comparação de índices como fonte principal quando há rentabilidade nominal/real.
2. Comparação com índices fica em `comparacao_indices`, preservando o comportamento visual do Investidor10.
3. BDRs e outros ativos de empresa agora recebem também `resultados` e `fluxo_caixa` quando a origem expõe esses blocos.
4. O extrator passou a procurar APIs/rotas de gráficos de empresas para ativos não-FII, incluindo BDR, stock e ETF quando aplicável.
5. O normalizador agora reconhece campos de fluxo de caixa como `operatingCashFlow`, `freeCashFlow`, `capex` e `cashFlow`.
6. O contador de renderização de gráficos agora considera `rows` e `items`; isso evita marcar tabelas de indicadores e lista de imóveis como vazias por engano.
7. O catálogo diferencia gráficos reais, blocos visíveis porém alimentados por outro fluxo e blocos não expostos pela origem.

## Política de dados

O Proxy não inventa séries. Se o Investidor10 mostra uma área visual, mas o HTML/API capturado não contém a série necessária naquele fluxo, o item permanece no manifesto com `renderable: false` e `sourceStatus` explicando o motivo.

Isso evita que o APK mostre gráfico falso, ao mesmo tempo em que permite ao app saber que aquele bloco existe visualmente na origem e pode ser preenchido por fluxo complementar, como cotação histórica.

## Testes adicionados

Foi adicionada a suíte:

- `test/mobile-chart-fidelity-investidor10-v21-13-15.test.js`

Ela cobre:

- BDR com receitas/lucros, lucro x cotação, resultados, fluxo de caixa e evolução patrimonial.
- FII de tijolo com histórico de indicadores, distribuições, dividend yield, dividendos e lista de imóveis.
- FII de papel com distribuição de ativos do fundo.
- ETF com rentabilidade nominal/real e sem falsos gráficos financeiros de empresa.

## Validações

- `npm test`: 113 arquivos de teste; 0 falhas.
- `npm run check`: 352 arquivos JS verificados.
- `npm run typecheck`: OK.
- `npm run audit:identity`: 0 ocorrências externas.
- `npm run smoke`: OK.
- `npm run audit:version`: OK.

## Observação final

Esta versão melhora a fidelidade visual e contratual dos gráficos, mas mantém a regra de segurança: o APK deve renderizar somente o que vier com dados reais. O manifesto permite diferenciar claramente o que foi capturado, o que é tabela, o que é série, o que é lista e o que depende de fluxo separado.
