// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.124';
export const VALORAE_RELEASE_PATCH = '21.12.124-analysis-source-extraction-v40';
export const VALORAE_RELEASE_LABEL = 'analysis-source-extraction-v40';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Análise com extração reforçada de DRE, Balanço, Fluxo de Caixa e receita por negócio/região a partir de fontes reais.';
