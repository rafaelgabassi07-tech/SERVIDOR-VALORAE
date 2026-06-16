
import assert from 'node:assert/strict';
import { _test } from '../lib/sources/asset-details.js';

const html = `
<div>INDICADORES FUNDAMENTALISTAS PETR4</div>
<div>P/L <strong>4,67</strong></div>
<div>P/Receita (PSR) <strong>1,01</strong></div>
<div>P/VP <strong>1,13</strong></div>
<div>Dividend Yield <strong>7,15%</strong></div>
<div>Payout <strong>38,98%</strong></div>
<div>Margem Líquida <strong>21,60%</strong></div>
<div>Margem Bruta <strong>47,36%</strong></div>
<div>Margem Ebit <strong>28,88%</strong></div>
<div>Margem Ebitda <strong>46,35%</strong></div>
<div>EV/Ebitda <strong>3,73</strong></div>
<div>EV/Ebit <strong>5,99</strong></div>
<div>P/Ebitda <strong>2,18</strong></div>
<div>P/Ebit <strong>3,49</strong></div>
<div>P/Ativo <strong>0,40</strong></div>
<div>P/Cap.Giro <strong>-10,33</strong></div>
<div>P/Ativo Circ. Liq. <strong>-0,45</strong></div>
<div>VPA <strong>34,54</strong></div>
<div>LPA <strong>8,35</strong></div>
<div>Giro Ativos <strong>0,40</strong></div>
<div>ROE <strong>24,17%</strong></div>
<div>ROIC <strong>12,95%</strong></div>
<div>ROA <strong>8,67%</strong></div>
<div>Dívida Líquida / Patrimônio <strong>0,73</strong></div>
<div>Dívida Líquida / Ebitda <strong>1,40</strong></div>
<div>Dívida Líquida / Ebit <strong>2,25</strong></div>
<div>Dívida Bruta / Patrimônio <strong>0,83</strong></div>
<div>Patrimônio / Ativos <strong>0,36</strong></div>
<div>Passivos / Ativos <strong>0,64</strong></div>
<div>Liquidez Corrente <strong>0,74</strong></div>
<div>CAGR Receitas 5 anos <strong>12,83%</strong></div>
<div>CAGR Lucros 5 anos <strong>77,66%</strong></div>`;

const parsed = _test.parseMetricsFromHtml(html);
const keys = parsed.indicators;
assert.equal(parsed.indicatorCards.length >= 31, true);
assert.equal(keys.pl, 4.67);
assert.equal(keys.psr, 1.01);
assert.equal(keys.pvp, 1.13);
assert.equal(keys.dividendYield, 7.15);
assert.equal(keys.payout, 38.98);
assert.equal(keys.margemLiquida, 21.6);
assert.equal(keys.evEbitda, 3.73);
assert.equal(keys.pCapGiro, -10.33);
assert.equal(keys.cagrReceitas5Anos, 12.83);
assert.equal(keys.cagrLucros5Anos, 77.66);
console.log('Stock fundamental indicators parser test OK.');
