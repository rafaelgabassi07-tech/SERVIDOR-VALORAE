// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.140';
export const VALORAE_RELEASE_PATCH = '21.12.140-analysis-modals-connected-v57';
export const VALORAE_RELEASE_LABEL = 'analysis-modals-connected-v57';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Análise mobile v57 conecta efetivamente os modais de ativos da carteira e do ranking ao contrato compartilhado, com superfície de consumo ativa no Proxy e UI compacta sem duplicar regra visual.';
