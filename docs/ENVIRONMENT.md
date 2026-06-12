# Environment — Valorae Proxy v21.12.0

Nenhuma variável é obrigatória para o modo free-only. Use `.env.example` como base local.

Principais variáveis:

| Variável | Uso | Padrão |
|---|---|---|
| `VALORAE_PUBLIC_BASE_URL` | URL pública do deploy | inferida por headers |
| `VALORAE_CORS_ALLOW_ORIGINS` | Allowlist CORS CSV | `*` quando strict desligado |
| `VALORAE_CORS_STRICT` | CORS estrito por base/allowlist | `0` |
| `VALORAE_RATE_LIMIT_MAX` | Limite por rota/IP | `90` |
| `VALORAE_RATE_LIMIT_WINDOW_MS` | Janela de rate limit | `60000` |
| `VALORAE_MAX_BODY_BYTES` | Limite de POST | `524288` |
| `VALORAE_MAX_URL_LENGTH` | Limite de URL/query | `4096` |
| `VALORAE_MAX_QUERY_PARAMS` | Limite de query params | `80` |
| `VALORAE_FETCH_TIMEOUT_MS` | Timeout de fontes externas | `12000` |
| `VALORAE_MAX_HTML_CHARS` | Máximo de HTML processado | `3200000` |
| `VALORAE_ADMIN_TOKEN` | Ativa rotas admin | vazio/desativado |
| `VALORAE_ADMIN_ALLOW_QUERY_TOKEN` | Permite token admin via query apenas fora de produção | `0` |
| `VALORAE_ADMIN_ALLOW_QUERY_TOKEN_IN_PRODUCTION` | Override explícito e não recomendado para query token em produção | `0` |
| `SUPABASE_URL` | URL do projeto Supabase para `/api/sync` | vazio/desativado |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave server-side para REST Supabase no Proxy | vazio/desativado |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` | Chave pública opcional para validar JWT do usuário | usa service key como fallback |
| `VALORAE_SUPABASE_SNAPSHOT_TABLE` | Tabela de snapshots | `valorae_user_snapshots` |
| `VALORAE_SUPABASE_CLIENTS_TABLE` | Tabela de clientes/dispositivos | `valorae_sync_clients` |
| `VALORAE_SUPABASE_TRANSACTIONS_TABLE` | Tabela de transações | `valorae_transactions` |
| `VALORAE_SUPABASE_DIVIDENDS_TABLE` | Tabela de proventos | `valorae_dividend_events` |
| `VALORAE_SUPABASE_SYNC_TOKEN` | Token admin legado opcional para sync | vazio/desativado |
| `VALORAE_SUPABASE_CLIENT_SECRET_PEPPER` | Pepper opcional para hash do segredo local | vazio |

| `VALORAE_ADAPTIVE_COMPLETION_ENABLED` | Liga complemento HTML sob demanda para reduzir PARTIAL | `1` |
| `VALORAE_ADAPTIVE_COMPLETION_TIMEOUT_MS` | Orçamento do complemento adaptativo | `4500` |
| `VALORAE_STATUSINVEST_COMPLEMENT_ENABLED` | Liga complemento StatusInvest quando campos críticos ficarem ausentes | `1` |
| `VALORAE_STATUSINVEST_COMPLEMENT_TIMEOUT_MS` | Timeout curto do complemento StatusInvest | `2800` |
| `VALORAE_COMPLETENESS_THRESHOLD_ACAO` | Score mínimo para considerar ação completa | `65` |
| `VALORAE_COMPLETENESS_THRESHOLD_FII` | Score mínimo para considerar FII completo | `60` |
| `VALORAE_BEST_SNAPSHOT_STALE_MS` | Validade do último snapshot real em memória | `21600000` |

Consulte também `/api/v1/env`, que expõe o catálogo sem revelar valores completos.
