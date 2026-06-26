// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.175';
export const VALORAE_RELEASE_PATCH = '21.12.175-br-date-final-audit-v145';
export const VALORAE_RELEASE_LABEL = 'br-date-final-audit-v145';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Proxy v145: revisão final de datas brasileiras, incluindo AAAA/MM/DD, sem alterar contratos técnicos.';
