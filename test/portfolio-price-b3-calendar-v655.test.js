import assert from 'node:assert/strict';
import { getB3MarketSession, isB3TradingDay } from '../lib/market/b3-calendar.js';
import { isB3RegularPortfolioSessionTimestamp } from '../lib/portfolio/history.js';

const duringSession = Math.floor(Date.parse('2026-08-11T15:00:00-03:00') / 1000);
const afterClose = Math.floor(Date.parse('2026-08-11T17:01:00-03:00') / 1000);
const nationalHoliday = Math.floor(Date.parse('2026-09-07T15:00:00-03:00') / 1000);

assert.equal(isB3RegularPortfolioSessionTimestamp(duringSession), true, 'dia útil às 15h deve pertencer ao pregão regular');
assert.equal(isB3RegularPortfolioSessionTimestamp(afterClose), false, '17:01 já está fora do pregão regular');
assert.equal(isB3RegularPortfolioSessionTimestamp(nationalHoliday), false, 'feriado B3 não pode receber ponto intradiário');

const ashWednesdayBeforeOpen = Math.floor(Date.parse('2026-02-18T12:59:00-03:00') / 1000);
const ashWednesdayOpen = Math.floor(Date.parse('2026-02-18T13:01:00-03:00') / 1000);
assert.equal(isB3RegularPortfolioSessionTimestamp(ashWednesdayBeforeOpen), false, 'quarta-feira de Cinzas 2026 não abre antes das 13h');
assert.equal(isB3RegularPortfolioSessionTimestamp(ashWednesdayOpen), true, 'quarta-feira de Cinzas 2026 deve aceitar pontos após 13h');
assert.equal(isB3TradingDay('2026-12-24'), false, '24/12/2026 não tem sessão B3');
assert.equal(isB3TradingDay('2026-12-31'), false, '31/12/2026 não tem sessão B3');
const ashSession = getB3MarketSession(new Date('2026-02-18T15:00:00Z'));
assert.equal(ashSession.regularOpen, '13:00', 'sessão especial de 18/02/2026 deve anunciar abertura às 13h');
const session = getB3MarketSession(new Date('2026-08-11T20:01:00Z'));
assert.equal(session.regularClose, '17:00');
assert.equal(session.status, 'after-hours');
console.log('portfolio-price-b3-calendar-v655: ok');
