// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.102';
export const VALORAE_RELEASE_PATCH = '21.12.103-analysis-unique-contract';
export const VALORAE_RELEASE_LABEL = 'analysis-hybrid-statusinvest-primary';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Análise híbrida com StatusInvest como fonte primária dos números e Investidor10 como referência visual, sem dados sintéticos';
