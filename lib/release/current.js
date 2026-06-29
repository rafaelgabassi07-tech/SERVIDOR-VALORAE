// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.180';
export const VALORAE_RELEASE_PATCH = '21.12.180-checklist-radar-v150';
export const VALORAE_RELEASE_LABEL = 'checklist-radar-v150';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Proxy v150 reforça Checklist Buy and Hold e Radar de Dividendos Inteligente no contrato da Análise para o APK.';
