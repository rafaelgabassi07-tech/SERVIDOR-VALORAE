-- VALORAE 2026-07-25 — parte 10/11
-- Índices alinhados às consultas do Proxy e limpeza de dados operacionais descartáveis.

create index if not exists valorae_transactions_user_ticker_client_idx
  on public.valorae_transactions (user_id, ticker, client_tx_id);
create index if not exists valorae_transactions_user_date_client_idx
  on public.valorae_transactions (user_id, transaction_date desc, client_tx_id);
create index if not exists valorae_dividend_events_user_category_payment_idx
  on public.valorae_dividend_events (user_id, category, payment_date);
create index if not exists valorae_dividend_events_ticker_idx
  on public.valorae_dividend_events (ticker);
create index if not exists valorae_sync_backups_user_created_idx
  on public.valorae_sync_backups (user_id, created_at desc);
create index if not exists valorae_sync_user_state_updated_idx
  on public.valorae_sync_user_state (updated_at desc);

-- Telemetria e coordenação efêmera não são dados financeiros.
do $$
begin
  if to_regclass('public.valorae_monitor_events') is not null then
    execute 'truncate table public.valorae_monitor_events';
  end if;
  if to_regclass('public.valorae_runtime_shared_state') is not null then
    execute 'truncate table public.valorae_runtime_shared_state';
  end if;
end $$;

-- O Proxy corrigido não cria novos backups integrais. Mantém somente os 3 mais recentes por usuário.
do $$
begin
  if to_regclass('public.valorae_sync_backups') is not null then
    with ranked as (
      select ctid,
             row_number() over (
               partition by user_id
               order by created_at desc, backup_id desc nulls last, ctid desc
             ) as rn
        from public.valorae_sync_backups
    )
    delete from public.valorae_sync_backups b
     using ranked r
     where b.ctid = r.ctid and r.rn > 3;
  end if;
end $$;

analyze public.valorae_user_snapshots;
analyze public.valorae_sync_clients;
analyze public.valorae_transactions;
analyze public.valorae_dividend_events;
analyze public.valorae_sync_backups;
analyze public.valorae_sync_user_state;

comment on table public.valorae_sync_user_state is
  'Revisão global, geração de exclusão e tombstone por usuário VALORAE.';
comment on table public.valorae_sync_backups is
  'Tabela legada de compatibilidade. As RPCs 2026-07-25 não criam backups integrais.';

notify pgrst, 'reload schema';
