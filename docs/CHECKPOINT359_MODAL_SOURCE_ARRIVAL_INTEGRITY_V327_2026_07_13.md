# Proxy 21.12.359 — v327

Valida chegada efetiva por seção nos modais e publica delivery schema v4.

- Histórico de indicadores só é considerado recebido quando contém linhas e valores efetivamente renderizáveis; mapas ou tabelas vazias não finalizam o modal.
- Comparação com índices só é considerada recebida quando existe série temporal real com pelo menos dois pontos; cards ou objetos sem histórico não contam como gráfico disponível.
- DRE, resultados e balanço patrimonial exigem linhas com valores úteis; containers estruturais vazios permanecem pendentes.
- Delivery schema v4 adiciona settledSections, emptyConfirmedSections, notApplicableSections, failedSections e sectionStates.
- Comunicados com ausência confirmada podem estabilizar como EMPTY_CONFIRMED, sem repetir chamadas indefinidamente.
- Portfólio imobiliário de FII de papel, recebíveis ou FOF pode estabilizar como NOT_APPLICABLE sem mostrar conteúdo incorreto.
- Falhas reais permanecem recuperáveis; seções vazias confirmadas e não aplicáveis deixam de consumir novas tentativas.
- Proxy publica diagnostics.sourceArrival e capabilities de diagnóstico de chegada; APK interpreta o mesmo estado para qualidade, cache e recovery.
- Completude e finalização passam a usar a mesma semântica de settlement, evitando resposta declarada completa sem conteúdo utilizável.
