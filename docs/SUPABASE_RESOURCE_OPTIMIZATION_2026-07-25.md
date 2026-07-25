# Otimização de recursos do Supabase — 2026-07-25

## Diagnóstico aplicado ao V-Proxy e ao APK

A auditoria do código encontrou fontes concretas de carga que podiam elevar CPU, I/O, WAL, autovacuum e quantidade de chamadas ao Supabase mesmo sem atividade financeira relevante:

1. **Telemetria do monitor:** eventos operacionais podiam ser persistidos em `valorae_monitor_events` e consultados novamente pelo painel.
2. **Estado operacional compartilhado:** a presença das credenciais do Supabase era suficiente para ativar remotamente circuit breaker, cache negativo, continuidade de contratos e leases de canário.
3. **Backups integrais por mutação:** operações de sincronização podiam copiar o payload financeiro completo para `valorae_sync_backups`.
4. **Atualizações sem mudança:** os RPCs atualizavam linhas e incrementavam revisão mesmo quando o conteúdo recebido era idêntico ao armazenado.
5. **Substituição integral de transações:** o fluxo de replace apagava e reinseria todo o conjunto, aumentando escrita, índices, WAL e tuplas mortas.
6. **Diagnóstico caro:** uma abertura do diagnóstico podia disparar várias consultas de esquema e leituras amplas.
7. **Autenticação repetida:** chamadas consecutivas validavam o mesmo bearer token várias vezes.
8. **Outbox vazia no APK:** alguns gatilhos de conectividade e ciclo de vida iniciavam sincronização mesmo quando não havia ação pendente.

## Comportamento depois da correção

### Telemetria

A persistência do monitor está **bloqueada no código**. `VALORAE_MONITOR_PERSISTENCE_ENABLED`, inclusive com valor verdadeiro, não reativa leitura ou escrita no Supabase. As métricas permanecem efêmeras em memória.

### Estado operacional do Proxy

O padrão é memória local. O estado remoto somente é habilitado com opt-in duplo e explícito:

```env
VALORAE_SHARED_STATE_MODE=supabase
VALORAE_SHARED_STATE_REMOTE_ENABLED=1
```

Não configure essas variáveis enquanto o objetivo for reduzir carga. Apenas `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` não ativam mais esse tráfego.

### Backups da sincronização financeira

Backups integrais estão desativados por padrão. A sincronização normal de transações, snapshots e proventos continua ativa.

```env
VALORAE_FINANCIAL_SYNC_BACKUPS_ENABLED=0
```

A variável não precisa existir: ausência equivale a `0`. A ativação deve ser temporária e deliberada.

### Cache operacional seguro

- Tokens válidos são reutilizados por até 5 minutos, nunca além da expiração do JWT.
- Tokens inválidos têm cache curto de 15 segundos.
- O diagnóstico é reutilizado por 5 minutos e chamadas simultâneas compartilham a mesma execução.
- O APK consulta o Supabase somente quando a outbox local contém operações pendentes.

## Migração obrigatória do banco

Depois de publicar o Proxy corrigido, execute **uma vez**, no SQL Editor do Supabase e na ordem indicada:

1. `supabase/007_valorae_resource_optimization_2026_07_25.sql`
2. `supabase/008_valorae_supabase_resource_diagnostics_2026_07_25.sql` — cada bloco é somente diagnóstico e pode ser executado separadamente.

A migração `007`:

- adiciona índices direcionados aos filtros reais da sincronização;
- evita `UPDATE` quando os valores não mudaram;
- incrementa revisão apenas quando houve alteração efetiva;
- substitui delete/reinsert integral por diff nas transações;
- grava backup apenas quando explicitamente solicitado e houve mudança;
- remove dados operacionais descartáveis de `valorae_monitor_events` e `valorae_runtime_shared_state`;
- preserva tabelas financeiras, usuários, carteiras, transações, snapshots e proventos;
- conserva as três cópias de backup mais recentes por usuário e elimina o excesso;
- executa `ANALYZE` nas tabelas financeiras.

A migração pressupõe que as migrações anteriores do projeto já foram aplicadas.

## Como confirmar a causa no projeto real

O arquivo `008_valorae_supabase_resource_diagnostics_2026_07_25.sql` mostra:

- consultas com maior tempo total e médio em `pg_stat_statements`;
- tabelas e índices de maior tamanho;
- quantidade estimada de linhas vivas e mortas;
- histórico de autovacuum/analyze;
- índices sem uso relevante;
- conexões ativas e estados de espera.

A auditoria local identifica os caminhos de alto custo no código, mas somente as métricas do projeto hospedado podem afirmar qual consulta foi a principal responsável pelo alerta naquele momento.

## Validação após o deploy

1. Confirme em `/api/server/metrics` que a persistência do monitor está inativa e o shared state está em `memory`.
2. Consulte `valorae_monitor_events` e `valorae_runtime_shared_state`; elas não devem voltar a crescer.
3. Compare CPU, I/O, conexões, WAL e chamadas por pelo menos um ciclo normal de uso.
4. Execute os blocos de `008` novamente e compare `total_exec_time`, `calls`, `n_dead_tup` e tamanho das relações.
5. Só considere aumentar compute se a carga continuar alta após o tráfego desnecessário e as consultas mais custosas terem sido corrigidos.
