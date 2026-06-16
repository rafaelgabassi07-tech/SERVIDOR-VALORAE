// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.98';
export const VALORAE_RELEASE_PATCH = '21.12.98-analysis-asset-summary-structured';
export const VALORAE_RELEASE_LABEL = 'analysis-asset-summary-structured';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'resumo do ativo estruturado na página Análise para Ações e FIIs, fiel ao topo do Investidor10 e sem valores sintéticos';
