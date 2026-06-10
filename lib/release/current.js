// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.86';
export const VALORAE_RELEASE_PATCH = '21.12.86-code-cleanup-contract-hygiene';
export const VALORAE_RELEASE_LABEL = 'code-cleanup-contract-hygiene';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'limpeza de código, contratos, testes e higiene de release APK/Proxy';
