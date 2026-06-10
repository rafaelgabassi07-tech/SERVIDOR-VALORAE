import fs from 'node:fs';

const batch = fs.readFileSync(new URL('../routes/dividends/batch.js', import.meta.url), 'utf8');
const bundle = fs.readFileSync(new URL('../routes/portfolio/insights-bundle.js', import.meta.url), 'utf8');
const release = fs.readFileSync(new URL('../lib/release/current.js', import.meta.url), 'utf8');

const checks = [
  ['release 21.12.88', release.includes("VALORAE_PUBLIC_VERSION = '21.12.88'")],
  ['batch exposes official future blocks', batch.includes('officialFutureEvents') && batch.includes('allOfficialFuturePayments')],
  ['batch received requires paymentDate', batch.includes('const hasPaymentDate = Boolean(paymentDate)') && batch.includes('const isPastPaid = hasPaymentDate && paymentDate < today')],
  ['batch status overrides portfolio blocks', batch.includes("status: 'Recebido'") && batch.includes("portfolioBlock: 'upcoming'")],
  ['bundle exposes official future blocks', bundle.includes('officialFutureEvents') && bundle.includes('allOfficialFuturePayments')],
  ['bundle received requires paymentDate', bundle.includes('const hasPaymentDate = Boolean(paymentDate)') && bundle.includes('const isPastPaid = hasPaymentDate && paymentDate < today')],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'OK' : 'FAIL'} - ${name}`);
if (failed.length) {
  console.error(`VALORAE Proxy agenda/evolução v21.12.88 FAILED: ${failed.map(([n]) => n).join(', ')}`);
  process.exit(1);
}
console.log('VALORAE Proxy agenda/evolução v21.12.88 OK');
