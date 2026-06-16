// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.97';
export const VALORAE_RELEASE_PATCH = '21.12.97-analysis-full-fundamentals-contract';
export const VALORAE_RELEASE_LABEL = 'analysis-full-fundamentals-contract';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'contrato mobile da página Análise com fundamentos completos por seção para Ações e FIIs, sem valores sintéticos';
