# Checkpoint 380 — hardening do runtime de scraping (Proxy v348)

Data: 2026-07-17  
Contrato estável: `2026.07.16-checkpoint117-v1`  
Hardening aditivo: `2026.07.17-checkpoint118-v1`

## Resultado executivo

A segunda rodada reproduziu e corrigiu três falhas sem alterar endpoints ou campos consumidos pelo Android:

1. O caminho htmlparser2 não cria toda a árvore implícita de navegador. Seletores como `body > main` e `table > tbody > tr` podiam divergir do parse5.
2. Uma resposta remota 429/5xx com corpo HTML podia entrar no cache como resposta fresca e continuar ocultando a recuperação da origem.
3. Cabeçalhos fornecidos pelo chamador eram mesclados depois da sanitização e podiam reintroduzir headers de conexão bloqueados.
4. O `package-lock.json` ainda continha URLs do registro interno do ambiente de auditoria, impedindo uma instalação limpa e portátil.

Também foi acrescentado fallback Windows-1252 somente para respostas textuais sem charset cujo byte stream é UTF-8 inválido, além de cancelamento do backoff quando a requisição pai é encerrada.

## Política do parser

- htmlparser2 continua sendo o padrão rápido para HTML comum.
- parse5 é escolhido quando os seletores dependem da árvore `html/head/body`, da inserção de seções de tabela ou das regras de formulários do navegador.
- tabelas comuns consultadas por seletores simples, como `td`, continuam no caminho rápido.
- conteúdo com foster parenting inválido dentro de `<table>` usa parse5 mesmo sem dica de seletor.

## Cache e transporte

- somente respostas HTTP bem-sucedidas ou revalidadas podem renovar o cache fresco;
- 4xx/5xx continuam disponíveis ao chamador, mas não envenenam a próxima consulta;
- headers são combinados antes do filtro final;
- `Host`, `Connection`, autenticação de proxy e demais hop-by-hop permanecem bloqueados;
- cancelamento do cliente interrompe também a espera exponencial entre tentativas.

## Portabilidade do release

Os endereços `resolved` do lockfile npm agora apontam para `registry.npmjs.org`; versões, integridades SHA-512 e o lockfile pnpm foram preservados. Uma asserção de regressão impede que o host interno do ambiente de auditoria volte ao pacote.

## Compatibilidade

O header `X-Valorae-Scraping-Engine` mantém a versão do Checkpoint 117. O Checkpoint 118 é anunciado em `hardeningVersion` dentro do mesmo manifesto. Assim, APK v527, APK v528 e Proxies anteriores continuam compatíveis; o v528 apenas reconhece os novos diagnósticos opcionais.

## Validação dedicada

O teste `test/scraping-runtime-hardening-checkpoint118-v348.test.js` cobre:

- `tbody` implícito e árvore `body`;
- permanência de tabelas simples no caminho htmlparser2;
- foster parenting;
- recuperação imediata após 503 sem cache contaminado;
- sanitização final de headers;
- decodificação de texto Windows-1252 sem charset;
- manifesto aditivo do hardening.

## Evidência de desempenho

No microbenchmark reproduzível de 255.208 bytes e 900 linhas, o caminho híbrido manteve paridade com parse5 e processou 33,80 operações/s. No mesmo ambiente, parse5 direto processou 8,79 operações/s e htmlparser2 direto 23,91 operações/s. Isso representa 74,01% menos latência que parse5 e 29,26% menos que htmlparser2 nesse fixture. O caminho simples de passagem única ficou em 8,708 ms, também com paridade do resultado esperado.

Resultado bruto: `docs/benchmarks/scraping-runtime-hardening-checkpoint118.json`.

## Matriz final

- 236 arquivos de teste do Proxy aprovados, sem falhas;
- 36 testes cross-stack Proxy/APK aprovados, sem falhas;
- 459 arquivos JavaScript aprovados na verificação de sintaxe;
- build Vercel-safe e auditoria de versão aprovados;
- `npm audit --omit=dev` sem vulnerabilidades conhecidas;
- contrato base do Checkpoint 117 preservado para o APK v527.
