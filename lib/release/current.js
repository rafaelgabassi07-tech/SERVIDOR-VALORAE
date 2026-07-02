// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.193';
export const VALORAE_RELEASE_PATCH = '21.12.193-notification-permissions-refinement-v163';
export const VALORAE_RELEASE_LABEL = 'notification-permissions-refinement-v163';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Proxy v163 refina o radar de notícias com termos de evento, metadados de relevância e maior cobertura de símbolos para as notificações da carteira.';
