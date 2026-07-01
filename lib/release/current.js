// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.189';
export const VALORAE_RELEASE_PATCH = '21.12.189-dividend-dates-analysis-modal-v159';
export const VALORAE_RELEASE_LABEL = 'dividend-dates-analysis-modal-v159';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Proxy v159 normaliza datas de proventos para gráficos, tooltips e histórico da Análise/modal, preservando pagamento, Data COM e competência quando disponíveis.';
