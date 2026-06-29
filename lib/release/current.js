// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.182';
export const VALORAE_RELEASE_PATCH = '21.12.182-checklist-radar-deep-fix-v152';
export const VALORAE_RELEASE_LABEL = 'checklist-radar-deep-fix-v152';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Proxy v152 aprofunda Checklist Buy and Hold e Radar de Dividendos no contrato da Análise, com parsing de meses em português, séries mensais e matching criterioso.';
