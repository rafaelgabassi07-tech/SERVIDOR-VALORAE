// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.177';
export const VALORAE_RELEASE_PATCH = '21.12.177-analysis-source-scale-audit-v147';
export const VALORAE_RELEASE_LABEL = 'analysis-source-scale-audit-v147';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Proxy v147: auditoria completa da Análise para preservar escala monetária na origem e evitar entrega de valores agregados sem unidade confiável ao APK.';
