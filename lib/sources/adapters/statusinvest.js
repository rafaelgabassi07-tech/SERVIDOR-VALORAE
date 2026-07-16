import { getConfirmedDividendsByTicker } from '../status-dividends.js';
import { registerSourceAdapter } from './core.js';

export const statusInvestSourceAdapter = registerSourceAdapter({
  id: 'statusinvest',
  label: 'StatusInvest',
  kind: 'dividends-and-fundamentals',
  official: false,
  freeOnly: true,
  domains: ['statusinvest.com.br'],
  description: 'Proventos confirmados por ticker e complementos de dados fundamentalistas.',
  operations: {
    confirmedDividends: getConfirmedDividendsByTicker,
  },
});
