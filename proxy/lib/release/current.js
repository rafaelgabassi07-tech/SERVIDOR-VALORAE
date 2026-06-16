// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.128';
export const VALORAE_RELEASE_PATCH = '21.12.128-analysis-source-routing-real-only-v44';
export const VALORAE_RELEASE_LABEL = 'analysis-source-routing-real-only-v44';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Análise com roteamento real por classe de ativo, extração HTML reforçada e bloqueio de séries derivadas sem período/fonte real.';
