import assert from 'node:assert/strict';
import { parseInvestidor10DividendAgendaHtml } from '../lib/market/investidor10-dividend-agenda.js';

function parseDateBR(value) {
  const m = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
}
function dayStartUTC(value) {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function sharesOwnedAt(transactions, ticker, date) {
  const key = String(ticker || '').toUpperCase();
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)).getTime();
  return transactions
    .filter(tx => String(tx.ticker || '').toUpperCase() === key && Number(tx.date) <= end)
    .reduce((acc, tx) => acc + (tx.sell ? -Number(tx.quantity || 0) : Number(tx.quantity || 0)), 0);
}
function isPaid(event, now) {
  const payment = parseDateBR(event.paymentDate);
  return Boolean(payment && payment < dayStartUTC(now));
}
function amountFor(event, transactions) {
  const eligibility = parseDateBR(event.dateCom) || parseDateBR(event.paymentDate);
  if (!eligibility) return 0;
  const shares = sharesOwnedAt(transactions, event.ticker, eligibility);
  return shares > 0 ? shares * Number(event.valuePerShare || 0) : 0;
}
function split(events, transactions, now) {
  const received = [];
  const agenda = [];
  for (const event of events) {
    const amount = amountFor(event, transactions);
    if (amount <= 0) continue;
    const payment = parseDateBR(event.paymentDate);
    if (isPaid(event, now)) received.push({ ...event, amount });
    else if (!payment || payment >= dayStartUTC(now)) agenda.push({ ...event, amount });
  }
  return { received, agenda };
}

const sampleHtml = `
  <html><body>
    15/07/26 Dividendos R$ 0,50 PETR4 Petrobras Data Com 01/07/26 Pgto 15/07/26<br>
    Provisionado JCP R$ 0,30 BBAS3 Banco Data Com 20/06/26 Pgto Provisionado<br>
    10/04/26 JCP R$ 0,20 VALE3 Vale Data Com 15/03/26 Pgto 10/04/26
  </body></html>`;
const parsed = parseInvestidor10DividendAgendaHtml(sampleHtml, { assetClass: 'ACAO' });
assert.ok(parsed.some(e => e.ticker === 'PETR4' && e.paymentDate === '15/07/2026' && e.dateCom === '01/07/2026'), 'PETR4 futuro confirmado deve ser capturado');
assert.ok(parsed.some(e => e.ticker === 'BBAS3' && !e.paymentDate && e.dateCom === '20/06/2026'), 'BBAS3 provisionado sem pagamento deve permanecer anunciado');
assert.ok(parsed.some(e => e.ticker === 'VALE3' && e.paymentDate === '10/04/2026'), 'VALE3 pago deve ser capturado');

const now = new Date('2026-06-10T12:00:00Z');
const txs = [
  { ticker: 'PETR4', date: Date.parse('2026-06-30T12:00:00Z'), quantity: 100 }, // antes da Data Com: agenda
  { ticker: 'BBAS3', date: Date.parse('2026-06-01T12:00:00Z'), quantity: 50 },  // antes da Data Com: agenda provisionada
  { ticker: 'VALE3', date: Date.parse('2026-03-01T12:00:00Z'), quantity: 80 },  // antes da Data Com: evolução
  { ticker: 'PETR4', date: Date.parse('2026-07-02T12:00:00Z'), quantity: 900 }, // depois da Data Com: não aumenta direito
];
const blocks = split(parsed, txs, now);
assert.equal(blocks.received.length, 1, 'Evolução deve conter só pagamento passado confirmado e elegível');
assert.equal(blocks.received[0].ticker, 'VALE3');
assert.equal(blocks.received[0].amount.toFixed(2), '16.00');
assert.ok(blocks.agenda.some(e => e.ticker === 'PETR4' && e.amount.toFixed(2) === '50.00'), 'Agenda deve usar quantidade na Data Com, não compra posterior');
assert.ok(blocks.agenda.some(e => e.ticker === 'BBAS3' && !e.paymentDate), 'Agenda deve manter provisionado sem data de pagamento');
assert.ok(!blocks.received.some(e => e.ticker === 'BBAS3'), 'Provisionado sem paymentDate nunca entra na evolução');
console.log('Dividend agenda/evolution v21.12.89 OK');
