// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.121';
export const VALORAE_RELEASE_PATCH = '21.12.121-analysis-final-audit-v37';
export const VALORAE_RELEASE_LABEL = 'analysis-final-audit-v37';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Auditoria final da Análise: validação de contrato único, edge cases, gráficos fiéis à fonte, sinalizações e pacote standalone.';
