import './yahoo.js';
import './investidor10.js';
import './statusinvest.js';
import './b3.js';
import './bcb.js';

export {
  VALORAE_SOURCE_ADAPTER_VERSION,
  VALORAE_SOURCE_ADAPTER_POLICY_VERSION,
  SourceAdapterDisabledError,
  buildSourceAdapterManifest,
  executeSourceAdapter,
  executeSourceFallback,
  isSourceAdapterEnabled,
  registerSourceAdapter,
  resetSourceAdapterMetricsForTests,
  unregisterSourceAdapterForTests,
  sourceAdapter,
  sourceAdapterMetrics,
} from './core.js';

import { executeSourceAdapter } from './core.js';

export const fetchYahooHistory = (...args) => executeSourceAdapter('yahoo', 'history', args);
export const fetchYahooQuote = (...args) => executeSourceAdapter('yahoo', 'quote', args);
export const fetchYahooLogo = (...args) => executeSourceAdapter('yahoo', 'logo', args);
export const fetchInvestidor10DirectIndexHistory = (...args) => executeSourceAdapter('investidor10', 'directIndexHistory', args);
export const fetchInvestidor10Rankings = (...args) => executeSourceAdapter('investidor10', 'rankings', args);
export const getConfirmedDividendsByTicker = (...args) => executeSourceAdapter('statusinvest', 'confirmedDividends', args);
export const fetchB3IndexDailyEvolution = (...args) => executeSourceAdapter('b3', 'indexHistory', args);
export const fetchBcbSeries = (...args) => executeSourceAdapter('bcb', 'series', args);
export const fetchIpca = (...args) => executeSourceAdapter('bcb', 'ipcaMarket', args);
export const getCdiAccumulatedSeries = (...args) => executeSourceAdapter('bcb', 'cdi', args);
export const getIpcaSeries = (...args) => executeSourceAdapter('bcb', 'ipca', args);
