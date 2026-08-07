# Relatório de validação — Fundação de refatoração VALORAE v595

**Data:** 6 de agosto de 2026  
**APK-fonte:** `2026.08.06.09` (`versionCode 26080609`)  
**Proxy:** `21.12.404-account-profile-v413`  
**Contrato de sincronização:** `valorae-financial-sync-v2`  
**Protocolo móvel:** `2026.07.10.10`

## Correções críticas concluídas

1. Política de identidade, qualidade e deduplicação de proventos centralizada, com perfis explícitos para transporte, restauração, agenda e parsing.
2. Modelos financeiros de domínio separados das entidades Room, com mapeadores bidirecionais.
3. Fronteiras locais independentes para ativos, transações, outbox e operações atômicas.
4. Estado global de autenticação, perfil e sincronização exposto por `StateFlow` somente leitura.
5. Rotas de notificações tipadas, mantendo aliases históricos.
6. Proxy pareado com a v595 sem alterar `/api/sync`, headers, campos financeiros, schema p404 ou protocolo móvel.
7. Referência residual de normalização no alias legado de transações corrigida e validada por compilação Kotlin isolada.

## Compatibilidade de dados preservada

- Room permanece na versão 13.
- Nenhuma tabela, coluna, índice ou migração foi removida ou renomeada.
- Nenhum `fallbackToDestructiveMigration` foi introduzido.
- Operações mult tabela continuam delegadas aos métodos Room `@Transaction` existentes.
- `clientTxId`, idempotência, tombstones, claims e retry da outbox permanecem compatíveis.
- Contrato `valorae-financial-sync-v2` e endpoint `/api/sync` permanecem inalterados.

## Resultados do APK-fonte

- Fundação v595: 24/24 verificações.
- Validador canônico: aprovado sobre 231 arquivos Kotlin.
- Contratos Python: 70/70 aprovados na rodada completa controlada.
- Política financeira e rotas: `V595_POLICY_ROUTE_RUNTIME_OK`.
- Modelos, aliases e `clientTxId`: `V595_DOMAIN_ALIAS_RUNTIME_OK`.
- Imports `domain -> data`: zero.
- `git diff --check`: aprovado.

## Resultados do Proxy

- Build Vercel-safe: aprovado.
- Sintaxe: 427 arquivos JavaScript aprovados.
- Auditoria on-demand: aprovada.
- Dead code: 152/152 módulos de runtime alcançáveis.
- SQL mínimo: aprovado; SHA-256 `dc612ba8430b9ca5d312113d77b92df9488df51b796c42ba20bb2d0d36e7d306`.
- Consistência de versão: aprovada.
- Suíte geral: 172 testes executáveis aprovados, zero falhas; 100 bloqueados (`cheerio`: 99, `undici`: 1).
- Suíte cruzada APK–Proxy: 26 executáveis aprovados, zero falhas; 17 bloqueados (`cheerio`: 16, `undici`: 1).

## Limitações reais do ambiente

A compilação Android não chegou ao código-fonte: o Gradle Wrapper tentou obter `gradle-8.10.2-bin.zip`, mas `services.gradle.org` não pôde ser resolvido (`UnknownHostException`). Portanto, a entrega é projeto-fonte, não APK binário.

A instalação das dependências bloqueadas do Proxy também não pôde ser concluída: o registro npm disponível retornou 404 para `whatwg-mimetype-4.0.0`. O ambiente executa Node 22.16.0, enquanto o projeto declara Node 24.x. Os testes disponíveis não apresentaram falhas.

## Decisão de escopo

As divisões físicas de DAOs, repositórios, ViewModel e telas monolíticas foram deliberadamente separadas em checkpoints posteriores. Misturá-las com a correção de integridade aumentaria o risco de regressão na sincronização. A v595 instala a fundação e os guardrails necessários para executar essas extrações de forma incremental e reversível.
