import { parseFinancialNumber } from '../normalizers/numbers.js';

export const VALORAE_CHART_SERIES_VERSION = '21.11.8-chart-series-normalized';

function arr(v) { return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]); }
function text(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }

function parseDate(value) {
  const s = text(value).toLowerCase();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return Date.parse(s) || null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y]=s.split('/').map(Number); return Date.UTC(y,m-1,d); }
  if (/^\d{2}[/-]\d{4}$/.test(s)) { const [m,y]=s.split(/[/-]/).map(Number); return Date.UTC(y,m-1,1); }
  const q=s.match(/(?:q|)([1-4])\s*t?\s*(\d{2,4})/i); if(q){const y=Number(q[2].length===2?`20${q[2]}`:q[2]); return Date.UTC(y,(Number(q[1])-1)*3,1);}
  return null;
}

function collectPoints(value) {
  const points=[];
  for (const item of arr(value).slice(0, 800)) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const xRaw = item.data || item.date || item.label || item.x || item.periodo || item.competencia || item.dataPagamento || item.dataCom || '';
      const yRaw = item.valor ?? item.value ?? item.y ?? item.preco ?? item.cotacao ?? item.rendimento ?? item.total ?? item.dividendo;
      const y = parseFinancialNumber(yRaw);
      if (y !== null) points.push({ x: parseDate(xRaw), y, label: text(xRaw), raw: yRaw });
    } else {
      const y = parseFinancialNumber(item);
      if (y !== null) points.push({ x: null, y, label: '', raw: item });
    }
  }
  return points;
}

function summarize(points) {
  const ys = points.map(p=>p.y).filter(Number.isFinite);
  if (!ys.length) return { min:null, max:null, first:null, last:null, changePercent:null };
  const first=ys[0], last=ys[ys.length-1];
  return { min:Math.min(...ys), max:Math.max(...ys), first, last, changePercent:first ? Math.round(((last-first)/Math.abs(first))*10000)/100 : null };
}

export function buildNormalizedChartSeries(results = {}, options = {}) {
  const out=[];
  const maxSeries = Math.max(1, Math.min(Number(options.maxSeries || 8), 20));
  for (const [key,value] of Object.entries(results || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [childKey, childValue] of Object.entries(value)) {
        const pts=collectPoints(childValue);
        if (pts.length>=2) out.push({ key:`${key}.${childKey}`, points:pts.slice(0,200), summary:summarize(pts), pointCount:pts.length });
      }
    } else {
      const pts=collectPoints(value);
      if (pts.length>=2) out.push({ key, points:pts.slice(0,200), summary:summarize(pts), pointCount:pts.length });
    }
  }
  out.sort((a,b)=>b.pointCount-a.pointCount);
  return { version: VALORAE_CHART_SERIES_VERSION, count: out.length, series: out.slice(0,maxSeries) };
}
