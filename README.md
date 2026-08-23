# VALORAE Proxy

Release público atual: **21.12.409**, pareado ao APK **v701 / 2026.08.22.02** (SOURCE `eaedd3305f21b7d4`, BUILD `84dcfb5f6beb7753`).

Proxy Vercel estritamente sob demanda para o APK VALORAE. O runtime possui uma única função física (`api/router.js`), não contém cron e não inicia consultas, timers ou coleta de dados ao ser importado. Em produção, as rotas da API aceitam somente requisições com a identidade canônica do APK.

## Banco mínimo

Para instalação ou recuperação, execute **uma única vez** `supabase/00_cloud_transaction_recovery.sql` no SQL Editor. O instalador é atômico e reúne, na ordem correta:

1. `supabase/01_transactions.sql`
2. `supabase/02_dividends.sql`
3. `supabase/03_legacy_block_and_verification.sql`

Os mesmos contratos também estão disponíveis no formato operacional de **dois arquivos completos**, compatível com a instalação já usada no Supabase:

1. `supabase/complete/01_transactions_COMPLETO.sql`
2. `supabase/complete/02_dividends_COMPLETO.sql`

Não misture os formatos na mesma execução: use o instalador único `00` ou execute os dois arquivos completos na ordem acima.

Depois de configurar as variáveis do Supabase no ambiente de deploy, execute `npm run verify:cloud-sync`. O gate verifica as duas tabelas e a RPC de status sem gravar transações.

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
npm run verify:cloud-sync  # no ambiente com credenciais Supabase
npm run test:cross-stack
```


## Compatibilidade do APK

- APK pareado: `2026.08.22.02` (v701 — v701 — Retorno por exposição real e UX refinada).
- APK mínimo aceito: `2026.07.30.01` (v569, versão instalada anterior ao hotfix).
- APK máximo homologado: `2026.08.22.02`.
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

## Árvore estática APK → Proxy → APK

A página pública inclui a árvore operacional `vertical-flow-v403`, implementada diretamente em `public/index.html` e estilizada por `public/ecosystem-map.css`.

O documento apresenta permanentemente a origem no Android, decisão entre Room e rede, transporte HTTPS, barreiras do roteador, os 17 endpoints homologados, fontes, cache, deadlines, fallbacks, normalização, retorno ao APK e caminhos de falha. Não há filtros, zoom, canvas, modal ou JavaScript. A CSP mantém `script-src 'none'` e `connect-src 'none'`; o monitor não consulta APIs, não inicia polling e não altera o runtime do Proxy.


## Recuperação da sincronização financeira

Execute `supabase/00_cloud_transaction_recovery.sql` no SQL Editor do Supabase, confirme o resultado, publique este Proxy e rode `npm run verify:cloud-sync` no ambiente configurado. O runtime tenta RPC v2 primeiro e usa PostgREST service-role como fallback quando a tabela já existe, mas a RPC ainda não entrou no schema cache.


### Testes históricos
`npm test` executa a suíte corrente. `npm run test:historical` inclui checkpoints imutáveis de releases anteriores que fixam versões antigas.
