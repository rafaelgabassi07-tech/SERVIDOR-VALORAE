-- VALORAE 2026-07-25 — diagnóstico opcional e somente leitura.
-- Execute cada bloco separadamente. Não faz parte da instalação obrigatória.

-- 1) Consultas com maior tempo acumulado.
select calls,
       round(total_exec_time::numeric, 2) as total_exec_ms,
       round(mean_exec_time::numeric, 2) as mean_exec_ms,
       rows,
       left(query, 500) as query
  from pg_stat_statements
 order by total_exec_time desc
 limit 25;

-- 2) Consultas com maior custo médio e pelo menos 5 chamadas.
select calls,
       round(mean_exec_time::numeric, 2) as mean_exec_ms,
       round(total_exec_time::numeric, 2) as total_exec_ms,
       rows,
       left(query, 500) as query
  from pg_stat_statements
 where calls >= 5
 order by mean_exec_time desc
 limit 25;

-- 3) Tamanho, linhas mortas e autovacuum das tabelas VALORAE.
select relname as table_name,
       pg_size_pretty(pg_total_relation_size(relid)) as total_size,
       pg_size_pretty(pg_relation_size(relid)) as table_size,
       pg_size_pretty(pg_indexes_size(relid)) as indexes_size,
       n_live_tup,
       n_dead_tup,
       last_autovacuum,
       last_autoanalyze
  from pg_stat_user_tables
 where schemaname = 'public'
   and relname like 'valorae_%'
 order by pg_total_relation_size(relid) desc;

-- 4) Índices com pouco uso observado. Não remova automaticamente.
select relname as table_name,
       indexrelname as index_name,
       idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) as index_size
  from pg_stat_user_indexes
 where schemaname = 'public'
   and relname like 'valorae_%'
 order by idx_scan asc, pg_relation_size(indexrelid) desc;

-- 5) Conexões e maior consulta ativa.
select state,
       count(*) as connections,
       max(now() - query_start) filter (where state = 'active') as longest_active
  from pg_stat_activity
 where datname = current_database()
 group by state
 order by connections desc;
