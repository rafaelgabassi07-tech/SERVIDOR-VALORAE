-- VALORAE — limpeza opcional de recursos não essenciais após validar a migration 013.
-- Execute somente DEPOIS de publicar o Proxy v363, instalar o APK v548 e confirmar
-- que o Histórico de transações e dividendos foi restaurado corretamente.
--
-- Este script elimina dados que não fazem mais parte do produto em nuvem. As tabelas
-- financeiras legadas permanecem temporariamente como backup de rollback, mas ficam sem
-- tráfego porque o Proxy novo usa exclusivamente valorae_financial_transactions e
-- valorae_financial_dividends.

do $$
begin
  if to_regclass('public.valorae_user_snapshots') is not null then execute 'truncate table public.valorae_user_snapshots'; end if;
  if to_regclass('public.valorae_sync_backups') is not null then execute 'truncate table public.valorae_sync_backups'; end if;
  if to_regclass('public.valorae_monitor_events') is not null then execute 'truncate table public.valorae_monitor_events'; end if;
  if to_regclass('public.valorae_runtime_shared_state') is not null then execute 'truncate table public.valorae_runtime_shared_state'; end if;
  if to_regclass('public.valorae_sync_clients') is not null then execute 'truncate table public.valorae_sync_clients'; end if;
  if to_regclass('public.valorae_sync_user_state') is not null then execute 'truncate table public.valorae_sync_user_state'; end if;
  if to_regclass('public.valorae_financial_state') is not null then execute 'truncate table public.valorae_financial_state'; end if;
end $$;

-- Impede deployments antigos de voltarem a escrever nos recursos desativados.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'valorae_user_snapshots',
    'valorae_sync_backups',
    'valorae_monitor_events',
    'valorae_runtime_shared_state',
    'valorae_sync_clients',
    'valorae_sync_user_state',
    'valorae_financial_state'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('revoke all on table public.%I from service_role', table_name);
    end if;
  end loop;
end $$;

-- Backup de transição preservado, sem uso pelo APK/Proxy novos:
-- public.valorae_transactions
-- public.valorae_dividend_events
--
-- Após alguns dias de validação, exporte essas duas tabelas e faça a remoção definitiva
-- em uma manutenção separada. Não remova as tabelas financeiras v2.
