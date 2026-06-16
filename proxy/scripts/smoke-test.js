import { buildMobilePortfolioSync } from '../lib/contracts/mobile.js';
const result = await buildMobilePortfolioSync({positions:[{ticker:'BBAS3',quantity:50,avgPrice:20,currentPrice:25,firstPurchaseDate:'2023-01-01'}],includeIpca:false,includeDividends:false,includeRankings:false});
if(result.status !== 'OK' || result.endpoint !== 'mobile-portfolio-sync') throw new Error('Smoke failed');
console.log('Smoke OK');
