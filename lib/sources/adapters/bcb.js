import { fetchBcbSeries, fetchIpca } from '../../market/bcb.js';
import { getCdiAccumulatedSeries } from '../cdi.js';
import { getIpcaSeries } from '../ipca.js';
import { registerSourceAdapter } from './core.js';

export const bcbSourceAdapter = registerSourceAdapter({
  id: 'bcb',
  label: 'Banco Central do Brasil',
  kind: 'official-macro-data',
  official: true,
  freeOnly: true,
  domains: ['api.bcb.gov.br'],
  description: 'Séries SGS oficiais de CDI, IPCA e indicadores macroeconômicos.',
  operations: {
    series: fetchBcbSeries,
    ipcaMarket: fetchIpca,
    cdi: getCdiAccumulatedSeries,
    ipca: getIpcaSeries,
  },
});
