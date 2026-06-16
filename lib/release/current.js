// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.105';
export const VALORAE_RELEASE_PATCH = '21.12.105-analysis-real-sections-and-charts';
export const VALORAE_RELEASE_LABEL = 'analysis-real-sections-and-charts';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Contrato único da Análise com seções reais, gráficos estruturados e sinalizações discretas sem dados sintéticos';
