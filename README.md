# VALORAE Proxy

Proxy Vercel estritamente sob demanda para o APK VALORAE. O runtime possui uma única função física (`api/router.js`), não contém cron e não inicia consultas, timers ou coleta de dados ao ser importado. Em produção, as rotas da API aceitam somente requisições com a identidade canônica do APK.

## Banco mínimo

Execute no Supabase, nesta ordem:

1. `supabase/01_transactions.sql`
2. `supabase/02_dividends.sql`
3. `supabase/03_legacy_block_and_verification.sql`

Não existem SQLs de snapshot, monitor, cache, dispositivo ou estado operacional. Circuit breaker, cache negativo, coalescência e continuidade usam somente memória efêmera da instância.

## Runtime

- `POST /api/v1/mobile/alerts`: consolida cotações, dividendos e notícias da Central de Notificações e dos workers em uma única invocação, executando somente os blocos explicitamente solicitados pelo APK.
- `POST /api/v1/mobile/daily-close`: devolve cotações, contribuições e a série consolidada 1D/5 min em uma resposta idempotente por carteira e data de negociação.
- `POST /api/v1/news/article`: busca e sanitiza matérias com HTTPS obrigatório, validação DNS/redirecionamentos, teto de resposta e cache centralizado.
- `GET /api/v1/quotes`: cotações de primeiro plano solicitadas pelo APK.
- `GET /api/v1/news`: notícias de primeiro plano solicitadas pelo APK.
- `POST /api/v1/dividends/batch`: agenda de dividendos solicitada pelo APK.
- `/api/sync`: transações, dividendos e verificação/bloqueio legado.

As rotas não executam pré-busca. Cada produtor de informação só é carregado quando a requisição recebida solicita o respectivo bloco.

## Monitor

A página estática inclui um **Mapa do ecossistema APK ↔ Proxy**, responsivo e explorável sem JavaScript, cobrindo jornadas, contratos, fontes, cache, sincronização e recuperação de falhas.

`public/index.html` é a única página estática do monitor. O monitor não chama a API, não consulta métricas do Vercel, não possui polling, JavaScript de rede, WebSocket, EventSource. Ele apenas informa o estado arquitetural do Proxy.

A telemetria detalhada do runtime foi removida do fluxo operacional. Para confirmar que a importação da função não inicia trabalho autônomo, execute `npm run audit:on-demand`.

## Proteção do cliente

Na Vercel ou com `NODE_ENV=production`, o modo APK-only é habilitado por padrão. Não configure `VALORAE_APK_ONLY=false` em produção. Os valores esperados podem ser ajustados por:

- `VALORAE_ANDROID_APP_ID`
- `VALORAE_MOBILE_PROTOCOL`

Para o uso privado solicitado, não existe segredo compartilhado entre APK e Proxy e nenhuma variável de autenticação precisa ser configurada manualmente. A rota `/api/sync` continua validando a sessão do usuário pelo token Bearer do Supabase.

## Validação

```bash
npm run build
npm run check:syntax
npm run audit:on-demand
npm run audit:dead-code
npm run audit:sql
npm run test:cross-stack
```


## Compatibilidade do APK

- APK pareado: `2026.07.30.03` (v571).
- APK mínimo aceito: `2026.07.30.01` (v569, versão instalada anterior ao hotfix).
- APK máximo homologado: `2026.07.30.03`.
- Política: `valorae-apk-compatibility-v2-backward-compatible`; rotas de leitura permanecem disponíveis para APKs com o protocolo móvel compatível. HTTP 426 fica restrito à sincronização financeira, onde incompatibilidade pode alterar dados do usuário.
- `VALORAE_REJECT_UNTESTED_FUTURE_APK=0` é um override operacional explícito; não deve ser usado rotineiramente em produção.
- `npm run verify:release` exige Node 24, dependências instaladas, APK real, suíte integral, testes cross-stack e auditoria estrita.

## Correções v399

- Restaura compatibilidade integral com o APK v569 (`2026.07.30.01`), que o Proxy v398 bloqueava com HTTP 426 antes de executar qualquer rota.
- Impede que divergências de versão derrubem análise, notícias, modais, rankings, cotações e retornos simultaneamente.
- Mantém o bloqueio de incompatibilidade apenas em `/api/sync`, protegendo gravações financeiras.
- Libera `/api/v1/asset/logo` sem headers customizados, requisito de carregadores de imagem como Coil.
- Corrige a função ausente de identificação da fonte no leitor de notícias.
- Permite redirecionamentos HTTPS entre Google News e o site público da matéria, com validação DNS e bloqueio de redes privadas em cada salto.
- Preserva o fechamento diário consolidado, cache limitado, rate limit e métricas introduzidos na v398.

## Limites operacionais

Cache, coalescência, métricas e rate limit permanecem deliberadamente em memória e limitados por instância serverless. Eles evitam crescimento ilimitado, mas não substituem rate limiting distribuído na borda da Vercel. O release de produção deve manter a proteção de borda habilitada e acompanhar `X-Valorae-Cache`, latência, códigos 426/429/5xx e tamanho das respostas.

## Mapa interativo APK ↔ Proxy

A página pública inclui a árvore operacional `interactive-flow-v401`, implementada em `public/ecosystem-flow-map.js` e `public/ecosystem-map.css`.

O componente documenta 44 etapas e 63 conexões reais entre o Android, transporte HTTPS, roteador, segurança, cache, fontes externas, Supabase e retorno ao estado Compose. Ele oferece filtros por jornada, busca, zoom, arraste, recolhimento de swimlanes, painel técnico por nó e histórico opcional da regressão v398 → v399. A CSP mantém `connect-src 'none'`; o mapa não consulta APIs, não inicia polling e não altera o runtime do Proxy.
