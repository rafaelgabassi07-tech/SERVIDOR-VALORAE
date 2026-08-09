# Monitor, Supabase e uso de CPU — correção de 2026-07-24

## Estado operacional adotado

O V-Proxy agora mantém a telemetria do monitor apenas em memória por padrão. A presença de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` não ativa mais a tabela `valorae_monitor_events`.

Configuração recomendada no deploy:

```env
VALORAE_MONITOR_PERSISTENCE_ENABLED=0
VALORAE_MONITOR_PERSISTENCE_SCOPE=production
```

Com essa configuração:

- respostas externas continuam aparecendo no monitor durante a vida da instância;
- não há `POST`/upsert de eventos do monitor no Supabase;
- `/api/server/metrics` não consulta o histórico remoto;
- cold starts podem zerar a linha do tempo, o que é intencional para telemetria efêmera;
- o painel consulta o snapshot a cada 15 segundos por padrão e ignora a aba quando ela está oculta.

## Dados que já existem

A alteração de código interrompe novas gravações, mas não apaga linhas antigas. Para medir o volume atual no SQL Editor:

```sql
select count(*) as events,
       pg_size_pretty(pg_total_relation_size('public.valorae_monitor_events')) as total_size
from public.valorae_monitor_events;
```

A migração `005` já criou uma função de limpeza em lotes. Para remover eventos anteriores ao momento da execução, rode repetidamente até retornar `0`:

```sql
select public.valorae_monitor_purge_events(
  p_scope := 'production',
  p_before := now(),
  p_limit := 50000
);
```

Essa operação é destrutiva para o histórico do monitor e deve ser executada somente após confirmar que os eventos não são necessários. Ela não remove dados financeiros, autenticação, carteira ou sincronização do aplicativo.

## Verificação após o deploy

1. Abra `/api/server/metrics` e confirme `monitorPersistence.active = false` e `monitorPersistence.operational = false`.
2. Deixe o monitor aberto por alguns minutos e confirme que o próprio `/api/server/metrics` não entra nos contadores externos.
3. Compare o gráfico de CPU e as consultas mais chamadas no Supabase antes e depois do deploy.
4. Caso a CPU permaneça alta, investigue as consultas de produto; o monitor não será mais uma fonte de escrita/leitura remota por padrão.
