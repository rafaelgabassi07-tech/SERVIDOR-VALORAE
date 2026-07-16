import { fetchB3IndexDailyEvolution } from '../../market/b3-index-history.js';
import { registerSourceAdapter } from './core.js';

export const b3SourceAdapter = registerSourceAdapter({
  id: 'b3',
  label: 'B3 Oficial',
  kind: 'official-exchange-data',
  official: true,
  freeOnly: true,
  domains: ['b3.com.br', 'www.b3.com.br'],
  description: 'Séries oficiais de índices e calendários da bolsa brasileira.',
  operations: {
    indexHistory: fetchB3IndexDailyEvolution,
  },
});
