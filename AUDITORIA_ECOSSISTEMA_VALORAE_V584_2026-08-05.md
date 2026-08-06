# Auditoria continuada do ecossistema VALORAE — APK v584 / Proxy 21.12.403

Data: 5 de agosto de 2026

## Escopo

Nova rodada de auditoria sobre os pacotes v583/p402, priorizando execução real e pontos ainda não cobertos: limites de memória e payload, transporte em segundo plano, circuit breaker, leitura de respostas do Supabase, Retry-After, observabilidade e alinhamento APK–Proxy.

## Falhas encontradas

### 1. Respostas remotas sem limite no APK

`ValoraeProxyHttp` e `ValoraeSyncClient` consumiam o corpo completo com `body.string()`. Um host incorreto, resposta corrompida ou payload anormalmente grande poderia pressionar a memória do processo Android antes de qualquer validação JSON.

**Correção:**

- respostas gerais do Proxy limitadas a 12 MiB;
- respostas da sincronização limitadas a 8 MiB;
- `Content-Length` é verificado quando disponível;
- respostas chunked também são interrompidas ao exceder o limite;
- sincronização retorna `SYNC_RESPONSE_TOO_LARGE`, não recuperável, sem aplicar dados locais.

### 2. Outbox dependia implicitamente da inicialização da Application

O `SyncOutboxWorker` inicializava o transporte geral do Proxy, mas não inicializava explicitamente o transporte específico de sincronização. Normalmente a `Application` executa primeiro, porém o worker não possuía autonomia explícita para reconstruir sua dependência.

**Correção:** `ValoraeSyncClient.installTransport(context)` passou a ser chamado no início do worker.

### 3. Logs excessivos do WorkManager em produção

O WorkManager era configurado com nível `INFO` em todos os builds.

**Correção:** builds debug mantêm `INFO`; builds release usam `WARN`.

### 4. Reset do circuit breaker podia falhar em runtime

`resetProviderHealth()` acessava `sharedRuntime.timers`, mas o objeto legado podia não possuir esse mapa. Isso produzia `TypeError` ao tentar resetar o estado.

**Correção:** migração defensiva do runtime global, criação segura de `timers` e normalização de `hydratedAt`.

### 5. Estado de provedores sem limite efetivo

Hosts desconhecidos podiam criar entradas indefinidamente no mapa do circuit breaker. O snapshot também podia retornar entradas já removidas durante a materialização dos provedores canônicos.

**Correção:**

- limite configurável de 64 provedores, restringido entre 8 e 256;
- evicção de hosts não canônicos;
- limpeza de timers associados;
- provedores canônicos materializados antes da construção do snapshot;
- parâmetros ambientais inválidos deixam de transformar limites em `NaN`.

### 6. Resposta do Supabase lida sem limite

O Proxy consumia `response.text()` integralmente. Respostas com `Content-Length` excessivo ou streaming chunked não tinham barreira.

**Correção:** limite padrão de 8 MiB, configurável entre 64 KiB e 32 MiB, aplicado tanto ao header quanto ao stream real.

### 7. Falha de leitura podia ser tratada como resposta vazia

`parseJsonResponse()` ignorava erros ao ler o corpo. Em uma resposta HTTP 200 com interrupção de stream, a operação poderia prosseguir com `null`.

**Correção:** falha de leitura agora retorna `SUPABASE_BODY_READ_FAILED`, recuperável, sem aceitar resposta vazia como sucesso.

### 8. Falhas de rede eram classificadas como timeout

Qualquer erro de `fetch`, inclusive DNS ou conexão recusada, era transformado em `SUPABASE_TIMEOUT`.

**Correção:**

- abort real → `SUPABASE_TIMEOUT`;
- DNS/conexão/transporte → `SUPABASE_NETWORK_ERROR`;
- intervalos de nova tentativa diferenciados.

### 9. Retry-After incompleto

Somente valores numéricos em segundos eram reconhecidos.

**Correção:** suporte adicional ao formato HTTP-date definido pelo protocolo HTTP.

## Nova identidade pareada

### APK

- versão interna: v584;
- versionCode: 26080503;
- versionName: 2026.08.05.03;
- checkpoint: `v584-ecosystem-resilience-hardening`.

### Proxy

- core: 21.12.0;
- versão pública: 21.12.403;
- patch: `21.12.403-ecosystem-resilience-v412`;
- monitor: `vertical-flow-v406`.

### Contrato

`valorae-ecosystem-2026.08.05.03-p403`

Os contratos p402 e p401 continuam aceitos durante a janela de implantação.

## Validação

### APK

- quality gate integral aprovado;
- 62 testes de regressão aprovados;
- novo contrato v584: 6/6;
- 217 arquivos Kotlin verificados;
- JSONs, Gradle, ambiente, changelog e metadados alinhados;
- gráficos, proventos, notificações, sincronização, restauração, segurança e navegação revalidados.

### Proxy

- `npm run verify` aprovado;
- build Vercel aprovado;
- sintaxe e imports sob demanda aprovados;
- runtime 152/152 módulos alcançáveis;
- SQL mínimo aprovado;
- consistência de versão aprovada;
- 171 testes executados, zero falhas;
- 100 bloqueados somente por dependências não instaladas: cheerio (99) e undici (1).

### Cross-stack

- 26 testes aprovados;
- zero falhas;
- 17 bloqueados pelas mesmas dependências ausentes.

## Limitações do ambiente

A compilação Kotlin foi tentada, porém o Gradle Wrapper não conseguiu resolver `services.gradle.org` para baixar o Gradle 8.10.2. A entrega contém projetos-fonte validados, não um APK binário.

As dependências `cheerio` e `undici` estão declaradas no pacote do Proxy, mas não estão instaladas neste ambiente. Os testes dependentes delas foram classificados como bloqueados, não como aprovados.
