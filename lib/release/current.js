// Fonte única da release pública do VALORAE Proxy.
// Evita divergência entre metadata, monitor, PWA, service worker, métricas e endpoints de integração.
export const VALORAE_CORE_VERSION = '21.12.0';
export const VALORAE_PUBLIC_VERSION = '21.12.208';
export const VALORAE_RELEASE_PATCH = '21.12.208-investidor10-gap-news-copy-audit-v178';
export const VALORAE_RELEASE_LABEL = 'investidor10-gap-news-copy-audit-v178';
export const VALORAE_CACHE_VERSION = VALORAE_PUBLIC_VERSION.replaceAll('.', '-');
export const VALORAE_RELEASE_DESCRIPTION = 'Auditoria contínua do Investidor10 com lacunas de apresentação de FIIs, alinhamento estrito de gráficos multi-série e suporte a notificações de notícias menos repetitivas no APK.';
