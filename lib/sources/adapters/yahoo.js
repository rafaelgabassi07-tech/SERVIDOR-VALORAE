import { fetchYahooHistory, fetchYahooLogo, fetchYahooQuote } from '../../market/yahoo.js';
import { registerSourceAdapter } from './core.js';

export const yahooSourceAdapter = registerSourceAdapter({
  id: 'yahoo',
  label: 'Yahoo Finance',
  kind: 'market-data',
  official: false,
  freeOnly: true,
  domains: ['query1.finance.yahoo.com', 'query2.finance.yahoo.com', 's.yimg.com'],
  description: 'Cotações, histórico e metadados de logotipo com cache e contingência entre hosts Yahoo.',
  operations: {
    history: fetchYahooHistory,
    quote: fetchYahooQuote,
    logo: fetchYahooLogo,
  },
});
