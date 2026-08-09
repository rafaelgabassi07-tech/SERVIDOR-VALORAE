# Auditoria de motores de scraping — Proxy 21.12.379 / v347

Data: 2026-07-16. Pareamento: APK v527 / Checkpoint 117.

## Escopo e conclusão

O universo de bibliotecas é aberto e não existe uma lista finita de “todos os scrapers”. A auditoria cobriu os motores e paradigmas relevantes ao Valorae: DOM em Node.js, crawlers com fila/sessão, navegadores, DOM com JavaScript e stacks Python nativas. A decisão foi evoluir o pipeline existente, porque ele já possuía allowlist, cache, stale-if-error, deduplicação de requisições, circuit breaker, backpressure, dados estruturados e fallback Playwright.

O resultado é aditivo: o caminho financeiro legado permanece oficial por padrão, enquanto o novo motor acelera o parser padrão em sombra e compartilha trabalho entre estágios. Não houve migração de framework nem alteração de campos existentes.

## Comparação técnica

| Motor/paradigma | Pontos úteis | Resultado para o Valorae |
|---|---|---|
| Cheerio 1.2.0 + parse5 | Árvore compatível com regras WHATWG e seletores CSS | Mantido como fallback de compatibilidade para conteúdo sensível e modo de rollback |
| Cheerio slim + htmlparser2 | Parser tolerante, rápido e econômico | Adotado como caminho padrão do novo parser adaptativo |
| Crawlee | Filas, AutoscaledPool, SessionPool e alternância HTTP/browser | Conceitos já cobertos pelo transporte, limites, cache e fallback do Valorae; migração integral rejeitada por custo e risco serverless |
| Playwright | Contextos baratos e isolados, interceptação de rede | Processo Chromium local reutilizado; contexto novo por execução, bloqueio de recursos preservado e espera explícita adicionada |
| Puppeteer/Selenium | Interceptação e esperas explícitas | Conceito de espera explícita aplicado sem adicionar outro runtime de navegador |
| jsdom | DOM com execução opcional de scripts | Não adotado: JavaScript remoto exigiria superfície de risco maior e não fornece layout real |
| LinkeDOM | DOM linear de baixo consumo | Não adotado: compatibilidade propositalmente parcial e ganho redundante com htmlparser2 |
| Scrapy | AutoThrottle, middleware, retries, cache e cookies | Retry-After limitado foi incorporado; reescrita Python rejeitada por duplicar controles já existentes |
| Beautiful Soup + lxml/html5lib | Escolha entre velocidade e correção em HTML inválido | Conceito equivalente implementado no seletor adaptativo htmlparser2/parse5; stack Python não é compatível com o deploy Node |
| selectolax/Lexbor | Parser C muito rápido | Não adotado por exigir runtime Python/binário nativo e ampliar o risco de deploy |

Fontes primárias: [Cheerio — configuração do parser](https://cheerio.js.org/docs/advanced/configuring-cheerio), [Cheerio — carregamento e encoding](https://cheerio.js.org/docs/basics/loading), [htmlparser2](https://github.com/fb55/htmlparser2), [parse5](https://parse5.js.org/), [Crawlee](https://crawlee.dev/js/docs/introduction), [Crawlee AutoscaledPool](https://crawlee.dev/js/api/core/class/AutoscaledPool), [Crawlee SessionPool](https://crawlee.dev/js/api/core/class/SessionPool), [Playwright BrowserContext](https://playwright.dev/docs/browser-contexts), [Playwright Network](https://playwright.dev/docs/network), [jsdom](https://github.com/jsdom/jsdom), [LinkeDOM](https://github.com/WebReflection/linkedom), [Scrapy AutoThrottle](https://docs.scrapy.org/en/latest/topics/autothrottle.html), [Scrapy downloader middleware](https://docs.scrapy.org/en/latest/topics/downloader-middleware.html), [Beautiful Soup](https://www.crummy.com/software/BeautifulSoup/bs4/doc/), [Selenium waits](https://www.selenium.dev/documentation/webdriver/waits/), [selectolax](https://github.com/rushter/selectolax).

## Benchmark contra o Valorae anterior

Fixture sintética: 255.208 bytes, 900 cards, 10 especificações CSS (4 aliases idênticos), três aquecimentos e 12 iterações em Node.js v24.14.0. A saída dos quatro motores DOM teve paridade byte-a-byte lógica com a referência parse5.

| Motor | ms/op | ops/s | Paridade parse5 |
|---|---:|---:|---|
| Valorae padrão anterior | 69,944 | 14,30 | Sim |
| Cheerio parse5 direto | 107,128 | 9,33 | Sim |
| Cheerio htmlparser2 direto | 43,308 | 23,09 | Sim |
| Valorae híbrido adaptativo | 33,369 | 29,97 | Sim |
| Valorae híbrido forçando parse5 | 66,715 | 14,99 | Sim |
| Valorae single-pass simples | 7,282 | 137,33 | Referência própria |

O híbrido reduziu a latência do parser padrão do Valorae em 52,29% e elevou o throughput em 2,10× nessa fixture. Contra parse5 direto, a redução foi de 68,85%. O caminho CSS-lite legado continua mais rápido em casos parciais, mas devolveu menos dados e, por isso, não é comparação equivalente. O benchmark é reproduzível com `node --expose-gc scripts/benchmark-scraping-engines.js --quick`; resultados completos ficam em `docs/benchmarks/scraping-engine-checkpoint117.json`.

## Implementações

1. Parser adaptativo htmlparser2/parse5, com decisão observável e fallback em erro.
2. DOM preguiçoso compartilhado entre seletores padrão e descoberta de JSON estruturado.
3. Deduplicação de consultas com a mesma tripla seletor/extrator/limite, preservando a ordem original das chaves.
4. Detecção limitada de BOM, charset do Content-Type e meta charset, com fallback UTF-8.
5. Retry-After em segundos ou data HTTP, limitado para não bloquear a instância.
6. Reutilização e rotação do processo Chromium local; contextos, cookies, storage e páginas nunca são compartilhados.
7. Espera pelo primeiro seletor ausente antes de usar networkidle no fallback dinâmico.
8. Novo manifesto `/api/v1/contract/scraping-engine`, headers CORS/HTTP e métricas do motor.
9. APK v527 pareado com accept/header, parser do manifesto, compatibilidade com header ausente e catálogo do endpoint.

## Compatibilidade e validação

- Mobile protocol e delivery schema existentes não mudaram.
- Rotas e campos anteriores permanecem; apenas um endpoint e dois headers foram adicionados.
- Modos padrão `shadow` continuam preservando a saída legada.
- Promoções continuam dependendo das flags e das mesmas regras de “sem perda”.
- `VALORAE_HTML_DOCUMENT_PARSER=parse5` restaura o parser anterior para todos os documentos.
- Proxy: build Vercel aprovado, sintaxe de 458 arquivos aprovada, 235 arquivos de teste aprovados, auditoria de versão aprovada e 35 testes cross-stack aprovados.
- APK: validador canônico aprovou 213 arquivos Kotlin, metadados e estrutura; o teste estrutural do Checkpoint 117 foi aprovado.
- O build binário Android não pôde ser executado neste contêiner: não há Android SDK/kotlinc e a rede não permite baixar Gradle 8.10.2. Isso é limitação do ambiente de auditoria, não uma falha observada no código.
