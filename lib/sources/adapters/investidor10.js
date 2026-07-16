import { fetchInvestidor10DirectIndexHistory } from '../../market/investidor10-index-history.js';
import { fetchInvestidor10Rankings } from '../../market/rankings-i10.js';
import { registerSourceAdapter } from './core.js';

export const investidor10SourceAdapter = registerSourceAdapter({
  id: 'investidor10',
  label: 'Investidor10',
  kind: 'fundamental-and-ranking-data',
  official: false,
  freeOnly: true,
  domains: ['investidor10.com.br'],
  description: 'Histórico direto de índices, rankings e dados estruturados públicos usados pelo VALORAE.',
  operations: {
    directIndexHistory: fetchInvestidor10DirectIndexHistory,
    rankings: fetchInvestidor10Rankings,
  },
});
