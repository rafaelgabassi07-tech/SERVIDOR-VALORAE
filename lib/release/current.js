// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.172';
export const VALORAE_RELEASE_PATCH = '21.12.172-presentation-copy-polish-v128';
export const VALORAE_RELEASE_LABEL = 'presentation-copy-polish-v128';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Proxy sincronizado ao APK v128: polimento textual e visual da apresentação, sem alteração funcional de contrato.';
