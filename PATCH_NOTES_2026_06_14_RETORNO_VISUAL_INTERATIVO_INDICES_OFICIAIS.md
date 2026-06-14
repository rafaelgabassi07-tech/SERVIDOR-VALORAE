# PATCH NOTES — 2026-06-14 — RETORNO_VISUAL_INTERATIVO_INDICES_OFICIAIS

## Escopo
Todos os ajustes desta rodada são referentes ao modal **Retorno**.

## APK
- Removido excesso de containers visuais do modal Retorno.
- Substituída a composição anterior por uma estrutura mais limpa:
  - filtro compacto no topo;
  - card único de resumo principal;
  - gráfico comparativo limpo;
  - destaques em lista objetiva;
  - tabela mensal compacta.
- O gráfico **Rentabilidade comparada com índices** agora reage ao toque:
  - desenha marcador vertical no ponto selecionado;
  - destaca o ponto em cada linha;
  - mostra os valores daquele mês em chips.
- Removidas informações permanentes consideradas desnecessárias no container do gráfico, como contador de pontos e bloco fixo de fechamento do período.
- O APK passa a solicitar ao Proxy os benchmarks:
  - CDI
  - IPCA
  - IBOV
  - SMLL
  - IFIX
  - IDIV
  - IVVB11

## Proxy
- IBOV, SMLL, IFIX e IDIV passam a usar a fonte oficial B3 de evolução diária.
- IFIX continua sem qualquer proxy, ETF ou ticker substituto.
- SMLL e IDIV também não usam ETF substituto.
- O parser da B3 foi reforçado para processar resposta HTML e JSON.
- IVVB11 permanece como o ativo ETF solicitado explicitamente para comparação internacional.

## Validação
- Version Code mantido: 26061314.
- Version Name mantido: 2026.06.13.3.
- Nenhuma mudança destrutiva em Agenda, Proventos ou Equilíbrio.
