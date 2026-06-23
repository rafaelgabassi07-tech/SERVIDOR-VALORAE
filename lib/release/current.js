// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.157';
export const VALORAE_RELEASE_PATCH = '21.12.157-release-tests-sync-hardening-v109';
export const VALORAE_RELEASE_LABEL = 'release-tests-sync-hardening-v109';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Checkpoint v109 corrige divergências de release, restaura testes do contrato de Análise e preserva Data COM, Data EX e COM estimada no sync de proventos.';
