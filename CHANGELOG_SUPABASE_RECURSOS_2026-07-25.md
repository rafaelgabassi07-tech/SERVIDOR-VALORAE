# VALORAE Proxy — correção de recursos Supabase — 2026-07-25

- Monitor rigidamente em memória, sem leitura ou escrita em `valorae_monitor_events`.
- Estado operacional em memória por padrão; Supabase remoto exige dois opt-ins explícitos.
- Backups financeiros integrais desativados por padrão.
- Cache temporário para validação de bearer e diagnóstico do schema.
- Diagnóstico combina probes e seleciona somente colunas necessárias.
- SQL atualizado em `supabase/release_2026_07_25/`.
