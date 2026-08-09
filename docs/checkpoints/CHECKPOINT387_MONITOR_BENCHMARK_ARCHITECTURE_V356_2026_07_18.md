# Checkpoint 387 — Benchmark e Arquitetura do Monitor (UI v356)

## Escopo

Este checkpoint reformula exclusivamente as páginas **Benchmark** e **Arquitetura** do monitor do Proxy. Rotas públicas, contratos financeiros, cache operacional, persistência no Supabase e integração com o APK permanecem inalterados.

## Benchmark orientado a decisão

A página deixou de apresentar uma tabela única e passou a separar três cargas tecnicamente diferentes:

1. **HTML estruturado** — extração equivalente de seletores, números, links e linhas de tabela.
2. **Extração simples** — seletores previsíveis em que uma passagem especializada pode evitar um DOM completo.
3. **DOM em navegador** — execução em Chromium para páginas dependentes de JavaScript.

Motores medidos no mesmo fixture e processo:

- VALORAE híbrido adaptativo;
- VALORAE passagem única;
- Parse5 direto com CSS Select;
- htmlparser2 direto com CSS Select;
- Cheerio com Parse5;
- Cheerio com htmlparser2;
- Playwright com Chromium.

JSDOM, LinkeDOM e node-html-parser são apresentados como referências de ecossistema, sem latências atribuídas quando não foram executados na mesma rodada.

Toda linha comparável inclui verificação de paridade estrutural com a saída-base. O caminho legado de CSS Lite permanece visível, mas é marcado como saída parcial e não participa da conclusão de equivalência.

O benchmark pode ser reproduzido com:

```bash
npm run benchmark:scraping
```

## Arquitetura explicável

A arquitetura agora é apresentada como fluxo por camadas com nove etapas interativas:

1. APK Valorae;
2. Edge e Router;
3. Gateway de contratos;
4. Cache e coalescing;
5. Orquestrador;
6. APIs e fontes HTML;
7. Scraping adaptativo;
8. Normalização e schema;
9. Resposta ao APK.

Cada etapa descreve responsabilidade, motivo de existência, falha dominante e mecanismo de proteção. Painéis adicionais explicam resiliência, persistência, estado efêmero e fronteiras de segurança.

## Validação

- build para Vercel aprovado;
- 472 arquivos JavaScript verificados;
- 246 arquivos de teste sem falhas;
- benchmark executado com paridade em todos os motores comparáveis;
- Chromium executado separadamente como categoria de capacidade distinta;
- páginas validadas em 1440, 900, 390 e 320 px;
- sem overflow horizontal, erros de console ou regressão de navegação;
- `public/index.html` e `public/server.html` idênticos.
