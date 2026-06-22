// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.152';
export const VALORAE_RELEASE_PATCH = '21.12.152-safe-yahoo-quotes-v101';
export const VALORAE_RELEASE_LABEL = 'safe-yahoo-quotes-v101';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Cotações seguras via Yahoo Finance com batch no Proxy, cache curto, backoff anti-429 e política mobile de atualização segura.';
