# Auditoria de sincronização do VALORAE Proxy — 2026-07-24

## Escopo

Auditoria de `/api/sync`, integração Supabase, classificação de erros e observabilidade, com foco nos HTTP 400, 409 e 503 registrados no monitor.

## Causas identificadas

1. A migração `006_valorae_financial_sync_integrity_v358.sql` continha SQL inválido no RPC de substituição de transações: um `AND` foi usado logo após `FROM jsonb_array_elements(...)`, onde deveria existir `WHERE`. A migração podia falhar ou ficar incompleta e o RPC não aparecer no cache de schema, originando 503.
2. A rota de sincronização importava o motor completo apenas para obter a versão. Isso acoplava `/api/sync` à pilha de scraping e aumentava dependências/custo de inicialização.
3. Chamadas ao Supabase e ao Supabase Auth não possuíam deadline próprio. Indisponibilidade de rede podia virar erro genérico ou manter a requisição aberta por tempo excessivo.
4. Falhas temporárias do Supabase Auth eram absorvidas e podiam ser reportadas como token inválido.
5. O Proxy descartava metadados necessários ao cliente para decidir entre corrigir, atualizar revisão ou tentar novamente.
6. O monitor agrupava conflito 409 recuperável no mesmo tratamento visual de erro genérico.

## Correções aplicadas

- Corrigido `AND` para `WHERE` na migração 006.
- `/api/sync` agora usa a versão leve exportada por `lib/release/current.js`, sem carregar o motor de scraping.
- Adicionado timeout configurável `VALORAE_SYNC_UPSTREAM_TIMEOUT_MS`, padrão de 8 segundos e faixa segura de 1 a 30 segundos.
- Erros de rede, timeout, leitura truncada e JSON inválido do upstream agora são 503 tipados e recuperáveis.
- Supabase Auth diferencia token rejeitado (401/403) de indisponibilidade, rate limit e resposta inválida.
- Respostas de erro agora incluem `action`, `code`, `retryable`, `retryAfterMs`, `conflict`, `currentSyncState` e `requestId`.
- Cabeçalhos adicionados: `X-Valorae-Sync-Code`, `X-Valorae-Sync-Retryable`, `X-Valorae-Sync-Conflict` e `Retry-After`.
- Em 409, o Proxy tenta devolver o estado atual da sincronização para recuperação imediata pelo aplicativo.
- Configuração Supabase ausente e migração 006 ausente/incompleta são classificadas como não recuperáveis até correção operacional.
- `diagnostics` retorna 503 quando o teste real de infraestrutura falha.
- Observabilidade captura código, retentativa, conflito e espera recomendada; o monitor identifica 409 recuperável como conflito, não como falha fatal.
- Testes antigos de sync foram atualizados para o contrato RPC revisionado atual e foi adicionado `test/sync-resilience-fix.test.js`.

## Validação executada

- `node --check` nos arquivos JavaScript alterados: aprovado.
- `npm run check:syntax`: 410 arquivos JavaScript verificados.
- `npm run build`: build Vercel aprovado.
- `npm run audit:version`: versões consistentes (`21.12.0` / patch público `21.12.394-runtime-safety-v362`).
- Testes focados de sync, schema, timestamp e substituição transacional: aprovados.
- Suíte completa: 261 arquivos; 154 aprovados, 107 bloqueados por dependências não instaladas (`cheerio`: 106, `undici`: 1), zero falhas funcionais.
- Importação isolada de `routes/sync.js`: aprovada em aproximadamente 0,03 s, sem depender da pilha de scraping.

## Arquivos principais alterados

- `routes/sync.js`
- `supabase/006_valorae_financial_sync_integrity_v358.sql`
- `lib/release/current.js`
- `lib/observability/server-metrics.js`
- `public/monitor-valorae.js`
- `public/index.html`
- `public/server.html`
- `.env.example`
- testes de sincronização em `test/`.

## Ordem de implantação

1. Fazer backup ou confirmar o ponto de restauração do Supabase.
2. Reaplicar integralmente `supabase/006_valorae_financial_sync_integrity_v358.sql` no mesmo projeto Supabase configurado no Proxy.
3. Publicar este Proxy v362 corrigido.
4. Validar `GET /api/sync?action=health` e `GET /api/sync?action=diagnostics`.
5. Publicar o aplicativo corrigido e confirmar que conflitos 409 são recuperados sem rajada de requisições.
