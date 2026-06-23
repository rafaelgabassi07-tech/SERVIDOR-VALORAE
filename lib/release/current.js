// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.164';
export const VALORAE_RELEASE_PATCH = '21.12.164-cinematic-scroll-fluidity-v120';
export const VALORAE_RELEASE_LABEL = 'cinematic-scroll-fluidity-v120';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Checkpoint v116 torna ranking da Home e notícias resilientes com fallback explícito para o APK.';
