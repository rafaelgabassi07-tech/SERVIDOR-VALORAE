# Checkpoint 371 / v339 — Parser HTML padrão em modo sombra

## Objetivo

Adicionar um parser HTML compatível com o padrão sem substituir o mecanismo legado ou alterar os contratos consumidos pelo APK.

## Implementação

- Cheerio 1.2.0 com parse5 para correção de HTML malformado e seletores CSS completos.
- `lib/scrape/selector-engine.js` mantém o fast path single-pass e coordena o parser CSS-lite legado com o parser padrão.
- O modo padrão é `shadow`: o resultado legado é sempre a saída oficial.
- A comparação registra cobertura, paridade, chaves perdidas, ganhas e divergentes.
- `prefer-standard` só promove a saída quando nenhuma chave preenchida pelo legado é perdida.

## Feature flags

- `VALORAE_STANDARD_HTML_PARSER_ENABLED`
- `VALORAE_STANDARD_HTML_PARSER_MODE=shadow|prefer-standard|legacy-only`
- `VALORAE_STANDARD_HTML_PARSER_MAX_CHARS`
- `VALORAE_STANDARD_HTML_PARSER_SHADOW_FAST_PATH`

## Diagnóstico

- Endpoint: `/api/v1/contract/html-parser-shadow`
- Header: `X-Valorae-Html-Parser-Shadow`
- Versão: `2026.07.15-checkpoint109-v1`
- Política: `standards-html-shadow-v1`

## Segurança de continuidade

Baseline, observabilidade e adaptadores dos Checkpoints 106–108 permanecem ativos. Nenhum valor financeiro depende do parser padrão neste checkpoint.
