// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.158';
export const VALORAE_RELEASE_PATCH = '21.12.158-quote-chart-comparison-deep-v114';
export const VALORAE_RELEASE_LABEL = 'quote-chart-comparison-deep-v114';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Checkpoint v114 mantém contratos do Proxy compatíveis com cotação unificada, gráficos de análise e comparação reforçada no APK.';
