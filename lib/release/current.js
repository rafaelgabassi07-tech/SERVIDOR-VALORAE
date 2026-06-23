// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.161';
export const VALORAE_RELEASE_PATCH = '21.12.161-settings-audit-fixes-v117';
export const VALORAE_RELEASE_LABEL = 'settings-audit-fixes-v117';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Checkpoint v117 mantém o Proxy compatível com o APK v117 após auditoria e correções da página Configurações, sem alteração quebrante de contrato.';
