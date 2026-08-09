# Checkpoint 383 — Monitor navigation, benchmark and architecture v352

## Interface

- Navegação principal movida para um menu hambúrguer acessível, com foco, Escape, backdrop e estado ativo por hash.
- Páginas: Ao vivo, Rotas e fontes, Saúde, Benchmark, Arquitetura e Ajustes.
- Cabeçalho mantém conexão, atualização, pausa, tema e identificação da página atual.

## Benchmark

- Página dedicada carrega `public/assets/valorae-monitor-benchmarks.json`.
- A execução atual compara Cheerio/Parse5, Cheerio/htmlparser2 e motores VALORAE sobre a mesma fixture.
- Paridade estrutural é mostrada separadamente; o CSS Lite parcial não é apresentado como equivalente.
- O comando reproduzível permanece disponível na própria página.

## Arquitetura

- Página dedicada documenta o fluxo do APK até a resposta, cache/coalescing, scraping, normalização, observabilidade e Supabase.
- Informações de runtime e persistência são preenchidas com o snapshot real de `/api/server/metrics`.

## Identidade

- O núcleo vetorial do logotipo replica os paths e as cores do launcher do APK.
- Um badge de conexão no canto inferior diferencia o Proxy sem alterar a marca principal.
