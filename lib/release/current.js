// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.96';
export const VALORAE_RELEASE_PATCH = '21.12.96-investidor10-analysis-page-contract';
export const VALORAE_RELEASE_LABEL = 'investidor10-analysis-page-contract';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'contrato mobile da página Análise com seções fiéis ao Investidor10 para Ações e FIIs, sem valores sintéticos';
