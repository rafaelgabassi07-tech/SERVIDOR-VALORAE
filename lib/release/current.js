// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.107';
export const VALORAE_RELEASE_PATCH = '21.12.107-analysis-real-charts-v28';
export const VALORAE_RELEASE_LABEL = 'analysis-real-charts-v28';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Gráficos reais da Análise com séries JSON estruturadas, Canvas no APK e política sem HTML/iframe/dados simulados';
