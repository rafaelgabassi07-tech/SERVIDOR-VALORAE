/**
 * Compatibilidade histórica do antigo driver de estado operacional no Supabase.
 *
 * O runtime atual mantém circuit breaker, cache negativo, continuidade e leases
 * exclusivamente na memória da instância serverless. Este módulo não executa fetch,
 * não acessa SQL/RPC e não pode ser reativado por variável de ambiente antiga.
 */
export function sharedStateRemoteDriverStatus() {
  return Object.freeze({ enabled: false, configured: false, driver: 'disabled', reason: 'memory-only-runtime' });
}

export async function sharedStateRemoteRequest() {
  const error = new Error('Estado compartilhado remoto desativado; use o armazenamento efêmero em memória.');
  error.code = 'SHARED_STATE_REMOTE_DISABLED';
  throw error;
}

export function sharedStateRemoteSelectPath() {
  return '';
}
