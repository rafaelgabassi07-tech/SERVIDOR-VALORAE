// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.99';
export const VALORAE_RELEASE_PATCH = '21.12.99-analysis-reset-clean-summary';
export const VALORAE_RELEASE_LABEL = 'analysis-reset-clean-summary';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'reset limpo da página Análise e do contrato do Proxy, com Resumo do Ativo funcional e sem renderizador legado';
