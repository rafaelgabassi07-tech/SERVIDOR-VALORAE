// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.142';
export const VALORAE_RELEASE_PATCH = '21.12.142-analysis-modal-curated-carteira-v61';
export const VALORAE_RELEASE_LABEL = 'analysis-modal-curated-carteira-v61';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Análise mobile v61 mantém a página Análise completa, cura os modais da Carteira e dos rankings para os 9 blocos solicitados e renomeia a navegação Ativos para Carteira.';
