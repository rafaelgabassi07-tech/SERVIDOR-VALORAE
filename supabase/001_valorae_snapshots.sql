-- Tabelas opcionais para snapshots oficiais do VALORAE.
create table if not exists valorae_official_dividend_events (
  ticker text not null,
  event_key text not null,
  date_com date,
  ex_date date,
  payment_date date,
  value_per_share numeric,
  dividend_type text,
  status text,
  asset_class text,
  source text,
  raw_payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (ticker, event_key)
);

create table if not exists valorae_user_dividend_events (
  user_id uuid not null,
  event_key text not null,
  ticker text not null,
  quantity_at_date numeric,
  gross_amount numeric,
  eligibility_status text,
  source text,
  created_at timestamptz default now(),
  primary key (user_id, event_key)
);
