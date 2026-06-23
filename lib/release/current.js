// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.159';
export const VALORAE_RELEASE_PATCH = '21.12.159-apk-proxy-contract-hardening-v115';
export const VALORAE_RELEASE_LABEL = 'apk-proxy-contract-hardening-v115';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Checkpoint v115 endurece o contrato APK+Proxy nas rotas reais de assets, histórico de cotação e índices.';
