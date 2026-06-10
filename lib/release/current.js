// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.88';
export const VALORAE_RELEASE_PATCH = '21.12.88-agenda-evolution-logic-fix';
export const VALORAE_RELEASE_LABEL = 'agenda-evolution-logic-fix';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'agenda futura completa, evolução retroativa de proventos, janelas ampliadas e limpeza de fluxo APK/Proxy';
