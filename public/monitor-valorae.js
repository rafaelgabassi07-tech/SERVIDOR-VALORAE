(() => {
  'use strict';

  const RELEASE_PATCH = '21.12.394-runtime-safety-v362';
  const MONITOR_VERSION = 'v366';
  const BENCHMARK_URL = '/assets/valorae-monitor-benchmarks.json';
  const STORAGE = {
    theme: 'valorae:monitor:theme', themeMode: 'valorae:monitor:themeMode', colorTheme: 'valorae:monitor:colorTheme', density: 'valorae:monitor:density', reducedMotion: 'valorae:monitor:reducedMotion', apiBase: 'valorae:monitor:apiBase', poll: 'valorae:monitor:pollMs',
    feedLimit: 'valorae:monitor:feedLimit', view: 'valorae:monitor:view',
  };

  const COLOR_THEMES = Object.freeze({
    gold: { label: 'Ouro Classic', light: '#8A6100', dark: '#FFCC5C' },
    champagne: { label: 'Coral Solar', light: '#BC4B3E', dark: '#E88A7D' },
    amber: { label: 'Turquesa Oceano', light: '#146A72', dark: '#72C2CC' },
    graphite: { label: 'Grafite Mineral', light: '#4A5568', dark: '#A0AEC0' },
    sapphire: { label: 'Azul Safira', light: '#2E5B82', dark: '#86B0D4' },
    emerald: { label: 'Esmeralda Verde', light: '#246648', dark: '#7CBC9C' },
    amethyst: { label: 'Lírio Ametista', light: '#5E457F', dark: '#A48BCD' },
    ruby: { label: 'Vermelho Rubi', light: '#992C32', dark: '#E38489' },
    platinum: { label: 'Cacau Bronze', light: '#7F4B30', dark: '#CFA084' },
  });
  const THEME_MODES = Object.freeze({ system: 'Sistema', light: 'Claro', dark: 'Escuro' });

  const ROUTES = {
    overview: '/monitor', traffic: '/monitor/traffic', request: '/monitor/requests', routes: '/monitor/routes',
    sources: '/monitor/sources', health: '/monitor/health', diagnostics: '/monitor/diagnostics',
    architecture: '/monitor/architecture', benchmark: '/monitor/benchmark', settings: '/monitor/settings',
  };
  const PAGE = {
    overview: ['Operação', 'Visão geral'], traffic: ['Operação', 'Tráfego'], request: ['Operação', 'Detalhe da requisição'],
    routes: ['Operação', 'Rotas'], sources: ['Operação', 'Fontes e cache'], health: ['Operação', 'Saúde'],
    diagnostics: ['Engenharia', 'Diagnósticos'], architecture: ['Engenharia', 'Arquitetura'],
    benchmark: ['Engenharia', 'Benchmark'], settings: ['Preferências', 'Ajustes'],
  };
  const HASH_ALIASES = { live: 'traffic', feed: 'traffic', command: 'traffic', output: 'traffic', performance: 'health', quality: 'health', comparison: 'benchmark', integration: 'architecture' };
  const $ = id => typeof id === 'string' ? document.getElementById(id) : id;
  const $$ = selector => [...document.querySelectorAll(selector)];
  const on = (target, type, handler, options) => { const el = typeof target === 'string' ? $(target) : target; if (el && typeof el.addEventListener === 'function') el.addEventListener(type, handler, options); };
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = text ?? ''; };
  const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html ?? ''; };
  const storage = {
    get(key, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} },
    remove(key) { try { localStorage.removeItem(key); } catch {} },
  };
  const state = {
    data: null, events: [], filtered: [], selectedId: null, view: 'overview', paused: false, loading: false,
    timer: null, controller: null, pollMs: bounded(storage.get(STORAGE.poll, '30000'), 30000, 15000, 120000),
    feedLimit: bounded(storage.get(STORAGE.feedLimit, '60'), 60, 30, 100), lastSuccessAt: 0, error: '',
    benchmark: null, benchmarkError: '', benchmarkScenario: 'complex', menuOpen: false,
  };
  let toastTimer;

  function bounded(value, fallback, min, max) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function num(value, digits = 2) { const number = Number(value); return Number.isFinite(number) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(number) : '—'; }
  function bytes(value) { const n = Number(value || 0); if (!Number.isFinite(n)) return '—'; if (n < 1024) return `${Math.round(n)} B`; if (n < 1048576) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`; return `${(n / 1048576).toFixed(1)} MB`; }
  function ms(value) { const n = Number(value); if (!Number.isFinite(n)) return '—'; return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)} s` : `${Math.round(n)} ms`; }
  function time(value) { const d = new Date(value || 0); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function dateTime(value) { const d = new Date(value || 0); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }); }
  function age(seconds) { const n = Math.max(0, Number(seconds || 0)); if (n < 60) return `${Math.round(n)} s`; if (n < 3600) return `${Math.floor(n / 60)} min`; return `${Math.floor(n / 3600)} h ${Math.floor((n % 3600) / 60)} min`; }
  function compact(value, length = 12) { const text = String(value || '—'); return text.length > length ? `${text.slice(0, length)}…` : text; }
  function toneForStatus(status, event = {}) { const code = Number(status || 0); if (code === 409 && event?.payloadSignals?.syncRetryable) return 'redirect'; if (code >= 400 || code === 0) return 'error'; if (code >= 300) return 'redirect'; return 'success'; }
  function eventId(event) { return String(event?.eventKey ?? event?.id ?? `${event?.at || ''}-${event?.route || ''}-${event?.requestId || ''}`); }
  function apiBase() { return String(storage.get(STORAGE.apiBase, '') || '').replace(/\/$/, ''); }
  function apiUrl(path) { return `${apiBase()}${path}`; }
  function summary() { return state.data?.summary || {}; }
  function distributions() { return state.data?.monitorAnalytics?.active ? state.data.monitorAnalytics.distributions || {} : state.data?.distributions || {}; }
  function routeDetails() { return state.data?.monitorAnalytics?.active ? state.data.monitorAnalytics.routeDetails || [] : state.data?.routeDetails || []; }
  function timeSeries() { return state.data?.monitorAnalytics?.active ? state.data.monitorAnalytics.timeSeries || [] : state.data?.timeSeries || []; }
  function metric(label, value, note = '', tone = '') { return `<article class="metric-card"><span>${esc(label)}</span><strong class="${tone ? `tone-${tone}` : ''}">${esc(value)}</strong><small>${esc(note)}</small></article>`; }
  function facts(rows) { return rows.map(([label, value, tone = '']) => `<div><dt>${esc(label)}</dt><dd class="${tone ? `tone-${tone}` : ''}">${esc(value ?? '—')}</dd></div>`).join(''); }
  function action(title, detail, tone = 'info') { return `<div class="action-item ${esc(tone)}"><i aria-hidden="true"></i><div><strong>${esc(title)}</strong><span>${esc(detail)}</span></div></div>`; }
  function empty(message) { return `<div class="empty-line">${esc(message)}</div>`; }

  function toast(message) { const node = $('toast'); if (!node) return; node.textContent = message; node.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2600); }
  function setConnection(kind, label) { const node = $('connectionState'); if (!node) return; node.className = `connection ${kind || ''}`; const text = node.querySelector('span'); if (text) text.textContent = label; }
  function schedule() { clearTimeout(state.timer); if (!state.paused) state.timer = setTimeout(() => refresh(), state.pollMs); }

  async function refresh({ manual = false } = {}) {
    if (state.loading) { if (manual) toast('Uma atualização já está em andamento.'); return; }
    if (state.paused && !manual) return;
    if (document.hidden && !manual) { schedule(); return; }
    state.loading = true;
    $('refreshButton')?.classList.add('is-loading'); $('refreshButton')?.setAttribute('aria-busy', 'true'); $('monitorMain')?.setAttribute('aria-busy', 'true');
    state.controller?.abort(); const controller = new AbortController(); state.controller = controller; let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);
    if (!state.data) setConnection('', 'Conectando');
    try {
      const response = await fetch(apiUrl('/api/server/metrics'), { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json', 'X-Valorae-App': 'VALORAE Proxy Monitor', 'X-Valorae-Channel': 'dashboard', 'X-Valorae-Telemetry': 'dashboard' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(); if (!data || data.ok === false) throw new Error(data?.error || 'Snapshot inválido');
      state.data = data;
      state.events = Array.isArray(data.proxyOutputMonitor?.outputFeed) ? data.proxyOutputMonitor.outputFeed : Array.isArray(data.recentEvents) ? data.recentEvents : [];
      state.lastSuccessAt = Date.now(); state.error = '';
      if (!state.selectedId && new URL(location.href).searchParams.get('event')) state.selectedId = new URL(location.href).searchParams.get('event');
      if (state.selectedId && !state.events.some(event => eventId(event) === state.selectedId) && state.view !== 'request') state.selectedId = null;
      setConnection(state.paused ? 'stale' : 'online', state.paused ? 'Pausado' : 'Atualizado'); renderAll();
    } catch (error) {
      if (timedOut) state.error = 'Tempo limite de 12 s'; else if (error?.name !== 'AbortError' || manual) state.error = error?.message || 'Falha de conexão';
      setConnection(state.data ? 'stale' : 'offline', state.data ? 'Dados anteriores' : 'Sem conexão'); renderHeader();
    } finally {
      clearTimeout(timeout); state.loading = false; $('refreshButton')?.classList.remove('is-loading'); $('refreshButton')?.setAttribute('aria-busy', 'false'); $('monitorMain')?.setAttribute('aria-busy', 'false'); if (state.controller === controller) state.controller = null; schedule();
    }
  }

  function renderAll() {
    renderHeader(); renderOverview(); renderTraffic(); renderRequest(); renderRoutes(); renderSources(); renderHealth(); renderDiagnostics(); renderArchitecture(); renderBenchmark(); renderSettings();
    if (state.view === 'health') requestAnimationFrame(drawChart);
  }

  function renderHeader() {
    const page = PAGE[state.view] || PAGE.overview; setText('pageEyebrow', page[0]); setText('currentPageLabel', page[1]);
    const release = state.data?.releasePatch || RELEASE_PATCH; setText('sidebarRelease', `${release.includes('v362') ? 'Core v362' : compact(release, 24)} · Monitor ${MONITOR_VERSION}`);
    setText('releaseLabel', release.includes('v362') ? 'Proxy v362' : compact(release, 24)); if ($('releaseLabel')) $('releaseLabel').title = release;
    setText('instanceLabel', state.data?.instance?.id ? `instância ${compact(state.data.instance.id, 8)}` : 'instância —');
    setText('updatedLabel', state.error ? `falha: ${state.error}` : state.lastSuccessAt ? `atualizado ${time(state.lastSuccessAt)}` : 'aguardando dados');
  }

  function renderOverview() {
    const s = summary(); const status = $('overviewStatus');
    if (!state.data) {
      status.className = 'status-banner neutral'; status.innerHTML = '<span class="status-dot"></span><div><strong>Aguardando métricas</strong><small>Conectando ao endpoint isolado do monitor.</small></div>';
      $('overviewMetrics').innerHTML = ['Disponibilidade','Latência p95','Taxa de erro','Cache','Memória'].map(label => metric(label, '—', 'aguardando')).join('');
      $('overviewEvents').innerHTML = empty('Nenhum evento disponível.'); $('overviewActions').innerHTML = action('Conexão pendente', 'A visão será preenchida assim que o endpoint responder.', 'info'); return;
    }
    const errorRate = Number(s.errorRatePercent || 0); const latencyBad = s.latencyAlertEligible && Number(s.p95LatencyMs || 0) > Number(s.sloP95TargetMs || 2500); const memoryAlert = Boolean(s.memoryPressureAlert || s.memoryPressure?.alert);
    const stateTone = errorRate > 5 || memoryAlert ? 'danger' : latencyBad || Number(s.captureGap || 0) > 0 ? 'warning' : '';
    status.className = `status-banner ${stateTone}`.trim();
    const title = stateTone === 'danger' ? 'Ação operacional recomendada' : stateTone === 'warning' ? 'Operação requer atenção' : 'Operação estável';
    status.innerHTML = `<span class="status-dot"></span><div><strong>${esc(title)}</strong><small>${esc(`${String(s.operationalState || 'saudável').replaceAll('_',' ')} · ${String(s.trafficState || 'sem tráfego').replaceAll('_',' ')} · monitor somente em memória`)}</small></div>`;
    $('overviewMetrics').innerHTML = [
      metric('Disponibilidade', `${num(s.availabilityPercent ?? 100)}%`, `SLO ${num(s.sloAvailabilityTargetPercent ?? 99)}%`, Number(s.availabilityPercent ?? 100) < Number(s.sloAvailabilityTargetPercent ?? 99) ? 'danger' : 'success'),
      metric('Latência p95', ms(s.p95LatencyMs), `${num(s.measuredLatencySamples || 0)} amostras`, latencyBad ? 'warning' : ''),
      metric('Taxa de erro', `${num(s.errorRatePercent || 0)}%`, `${num(s.errors || 0)} erros`, errorRate > 5 ? 'danger' : 'success'),
      metric('Cache', `${num(s.cacheHitRatePercent || 0)}%`, `${num(s.cacheHits || 0)} hits`, Number(s.cacheHitRatePercent || 0) < 20 && Number(s.responses || 0) > 10 ? 'warning' : ''),
      metric('Memória RSS', `${num(s.memoryRssMb || 0)} MB`, `heap ${num(s.heapUsedMb || 0)} MB`, memoryAlert ? 'danger' : ''),
    ].join('');
    const latest = state.events.slice(0, 6);
    $('overviewEvents').innerHTML = latest.length ? latest.map(event => `<a class="compact-event" href="${ROUTES.request}?event=${encodeURIComponent(eventId(event))}" data-event-link="${esc(eventId(event))}"><time>${esc(time(event.at))}</time><div><strong>${esc(`${event.method || 'GET'} ${event.route || '/'}`)}</strong><small>${esc(event.appName || event.device || 'Consumidor API')}</small></div><span class="status-code ${toneForStatus(event.status,event)}">${esc(event.status || '—')}</span></a>`).join('') : empty('Nenhuma resposta externa capturada nesta instância.');
    const actions = [];
    if (memoryAlert) actions.push(action('Pressão de memória', s.memoryPressure?.reason || 'A instância ultrapassou o limite operacional configurado.', 'danger'));
    if (latencyBad) actions.push(action('Latência acima do alvo', `p95 ${ms(s.p95LatencyMs)} para alvo ${ms(s.sloP95TargetMs)}.`, 'warning'));
    if (errorRate > 5) actions.push(action('Taxa de erro elevada', `${num(errorRate)}% das respostas da janela falharam.`, 'danger'));
    if (Number(s.captureGap || 0) > 0) actions.push(action('Lacuna de captura', `${num(s.captureGap)} requisições não tiveram resposta observada.`, 'warning'));
    if (!s.externalTrafficObserved) actions.push(action('Sem tráfego externo', 'O monitor está íntegro, mas ainda não observou chamadas reais do APK nesta instância.', 'info'));
    if (!actions.length) actions.push(action('Nenhuma ação crítica', 'SLO, captura e runtime estão dentro dos limites observados.', 'success'));
    $('overviewActions').innerHTML = actions.join('');
  }

  function populateFilters() {
    const methods = [...new Set(state.events.map(event => String(event.method || 'GET').toUpperCase()))].sort();
    const apps = [...new Set(state.events.map(event => String(event.appName || event.device || 'Consumidor API')))].sort((a, b) => a.localeCompare(b));
    replaceOptions($('methodFilter'), [['all', 'Todos os métodos'], ...methods.map(value => [value, value])]);
    replaceOptions($('appFilter'), [['all', 'Todos os consumidores'], ...apps.map(value => [value, value])]);
  }
  function replaceOptions(select, entries) { if (!select) return; const prior = select.value || 'all'; const signature = entries.map(e => e.join(':')).join('|'); if (select.dataset.signature !== signature) { select.innerHTML = entries.map(([v,l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(''); select.dataset.signature = signature; } select.value = entries.some(([v]) => v === prior) ? prior : 'all'; }
  function filterEvents() {
    const search = String($('feedSearch')?.value || '').trim().toLowerCase(); const status = $('statusFilter')?.value || 'all'; const method = $('methodFilter')?.value || 'all'; const app = $('appFilter')?.value || 'all';
    return state.events.filter(event => {
      const code = Number(event.status || 0); if (status === 'success' && !(code >= 200 && code < 400)) return false; if (status === 'error' && code < 400) return false; if (status === 'slow' && !event.slow && Number(event.latencyMs || 0) < 2500) return false; if (status === 'aborted' && !event.aborted && !event.clientClosed && code !== 499) return false;
      if (method !== 'all' && String(event.method || 'GET').toUpperCase() !== method) return false; const appName = String(event.appName || event.device || 'Consumidor API'); if (app !== 'all' && appName !== app) return false;
      if (!search) return true; return JSON.stringify([event.route,event.ticker,event.requestId,event.appName,event.appChannel,event.sourceStatus,event.cacheStatus,event.method,event.status]).toLowerCase().includes(search);
    });
  }
  function renderTraffic() {
    const s = summary(); populateFilters(); state.filtered = filterEvents().slice(0, state.feedLimit);
    $('trafficCount').textContent = `${num(state.filtered.length)} de ${num(state.events.length)} eventos`; $('trafficRetention').textContent = state.data?.proxyOutputMonitor?.scope?.persistence || 'Memória da instância';
    $('trafficMetrics').innerHTML = [metric('Requisições',num(s.requests||0),`${num(s.requestsPerMinute1m||0)}/min`),metric('Respostas',num(s.responses||0),`${num(s.successRatePercent||0)}% sucesso`,Number(s.errorRatePercent||0)>5?'warning':'success'),metric('Em voo',num(s.inFlight||0),s.oldestActiveRoute||'nenhuma pendência'),metric('Dados enviados',bytes(s.bytesOut||0),`p95 ${bytes(s.payloadP95BytesOut||0)}`)].join('');
    $('eventFeed').innerHTML = state.filtered.length ? state.filtered.map(event => {
      const source = event.sourceStatus || event.source || event.provider || '—'; const cache = event.cacheStatus || event.cache || '—';
      return `<button class="event-row" type="button" data-event-id="${esc(eventId(event))}"><time>${esc(time(event.at))}</time><div class="event-request"><strong><span class="method">${esc(String(event.method||'GET').toUpperCase())}</span><span>${esc(event.route||'/')}</span></strong><small>${esc([event.appName||event.device||'Consumidor API',event.ticker||event.view].filter(Boolean).join(' · '))}</small></div><div class="event-source"><strong>${esc(source)}</strong><small>cache ${esc(cache)}</small></div><div class="event-result"><strong class="status-code ${toneForStatus(event.status,event)}">${esc(event.status||'—')}</strong><strong>${esc(ms(event.latencyMs))}</strong><small>${esc(`${bytes(event.bytesOut||0)} · ${compact(event.requestId||'sem request-id',16)}`)}</small></div></button>`;
    }).join('') : empty(state.events.length ? 'Nenhum evento corresponde aos filtros.' : 'Nenhuma resposta externa capturada nesta instância.');
  }

  function selectedEvent() { return state.events.find(event => eventId(event) === state.selectedId) || null; }
  function renderRequest() {
    const event = selectedEvent(); const emptyNode = $('requestEmpty'); const content = $('requestContent'); const copy = $('copyEventButton');
    if (!event) { emptyNode.hidden = false; content.hidden = true; copy.disabled = true; $('requestTitle').textContent = 'Detalhe da requisição'; $('requestSubtitle').textContent = state.selectedId ? 'O evento não está mais disponível na janela desta instância.' : 'Selecione um evento no tráfego para abrir a análise completa.'; return; }
    emptyNode.hidden = true; content.hidden = false; copy.disabled = false; $('requestTitle').textContent = `${String(event.method||'GET').toUpperCase()} ${event.route||'/'}`; $('requestSubtitle').textContent = `${dateTime(event.at)} · request ${event.requestId || 'não informado'}`;
    $('requestMetrics').innerHTML = [metric('Status',String(event.status||'—'),event.errorCode||event.outcome||'resposta HTTP',toneForStatus(event.status,event)==='error'?'danger':'success'),metric('Latência',ms(event.latencyMs),event.slow?'classificada como lenta':'tempo total',event.slow?'warning':''),metric('Entrada',bytes(event.bytesIn||0),'corpo recebido'),metric('Saída',bytes(event.bytesOut||0),'payload entregue')].join('');
    $('requestInputFacts').innerHTML = facts([['Consumidor',event.appName||event.device||'Consumidor API'],['Canal',event.appChannel||event.channel||'—'],['Ticker',event.ticker||'—'],['Visualização',event.view||event.mode||'—'],['Método',String(event.method||'GET').toUpperCase()],['Request ID',event.requestId||'—'],['Região',event.vercelRegion||event.region||'—'],['Parâmetros',event.safeQuery&&Object.keys(event.safeQuery).length?JSON.stringify(event.safeQuery):'—']]);
    const partialLabel = typeof event.partial === 'object' ? (event.partial.classification || (event.partial.detected ? 'sim' : 'não')) : (event.partialStatus || event.partial || 'não');
    const renderSafe = event.renderSafe ?? event.payloadSignals?.renderSafe;
    $('requestOutputFacts').innerHTML = facts([['Status HTTP',event.status||'—',toneForStatus(event.status,event)==='error'?'danger':'success'],['Origem',event.sourceStatus||event.source||event.provider||'—'],['Cache',event.cacheStatus||event.cache||'—'],['Interceptador',event.interceptor||event.interceptedBy||'—'],['Parcial',partialLabel],['Render seguro',renderSafe===false?'não':'sim',renderSafe===false?'danger':'success'],['Encerramento',event.aborted||event.clientClosed?'cancelado':'completo']]);
    const signals = [];
    const signalObjects = [event.payloadSignals,event.contractSignals,event.responseSignals].filter(v => v && typeof v === 'object');
    signalObjects.forEach(object => Object.entries(object).forEach(([key,value]) => { if (value !== null && value !== false && value !== '' && value !== 0) signals.push(`${key}: ${typeof value==='object'?JSON.stringify(value):value}`); }));
    for (const value of [event.payloadKind,event.contentType,event.sourceStatus,event.cacheStatus,event.partialStatus]) if (value) signals.push(String(value));
    $('requestSignals').innerHTML = signals.length ? [...new Set(signals)].slice(0,40).map(value => `<span class="chip">${esc(value)}</span>`).join('') : '<span class="chip">sem sinais adicionais</span>';
    const payload = event.payloadPreview ?? event.responsePreview ?? event.outputPreview ?? event.preview ?? event; $('requestPayload').textContent = typeof payload === 'string' ? payload : JSON.stringify(payload,null,2);
  }

  function renderRoutes() {
    const routes = routeDetails(); const search = String($('routeSearch')?.value || '').trim().toLowerCase(); const filtered = routes.filter(row => !search || JSON.stringify(row).toLowerCase().includes(search)); const s = summary();
    $('routeCount').textContent = `${num(filtered.length)} rotas`; $('routeMetrics').innerHTML = [metric('Rotas observadas',num(s.routesTracked||routes.length),'na janela atual'),metric('Cobertura',`${num(s.routeCoverageScore??100)}%`,'score de rotas'),metric('p95 global',ms(s.p95LatencyMs),`${num(s.measuredLatencySamples||0)} amostras`),metric('Saída média',bytes(s.avgBytesOut||0),'por resposta')].join('');
    $('routeTable').innerHTML = filtered.length ? filtered.map(row => `<tr><td>${esc(row.route||row.path||'—')}</td><td>${esc(row.method||'—')}</td><td>${esc(num(row.responses||row.count||0))}</td><td class="${Number(row.errors||0)>0?'tone-danger':''}">${esc(num(row.errors||0))}</td><td>${esc(ms(row.p95LatencyMs??row.latencyP95Ms))}</td><td>${esc(bytes(row.avgBytesOut||row.averageBytesOut||0))}</td><td>${esc(row.cacheHitRatePercent!=null?`${num(row.cacheHitRatePercent)}%`:row.cacheStatus||'—')}</td><td>${esc(dateTime(row.lastAt||row.lastEventAt))}</td></tr>`).join('') : `<tr><td colspan="8">${esc(routes.length?'Nenhuma rota corresponde à busca.':'Nenhuma rota externa observada nesta instância.')}</td></tr>`;
  }

  function normalizeDistribution(value) {
    if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? { label: item.label??item.name??item.key??item.value??'—', count: Number(item.count??item.total??item.responses??item.value??0) } : { label:String(item),count:1 });
    if (value && typeof value === 'object') return Object.entries(value).map(([label,count]) => ({label,count:Number(count)||0})); return [];
  }
  function renderDistribution(id, rows) { const normalized = normalizeDistribution(rows).sort((a,b)=>b.count-a.count); const max = Math.max(1,...normalized.map(item=>item.count)); $(id).innerHTML = normalized.length ? normalized.slice(0,15).map(item => `<div class="distribution-row"><span title="${esc(item.label)}">${esc(item.label)}</span><span class="distribution-bar"><i style="width:${Math.max(3,Math.round(item.count/max*100))}%"></i></span><strong>${esc(num(item.count))}</strong></div>`).join('') : empty('Sem dados suficientes nesta janela.'); }
  function renderSources() {
    const s = summary(); const d = distributions(); $('sourceMetrics').innerHTML = [metric('Eficiência do cache',`${num(s.cacheEfficiencyScore??100)}%`,`${num(s.cacheHits||0)} hits`),metric('Confiabilidade',`${num(s.sourceReliabilityScore??100)}%`,`${num(s.blockedSources||0)} bloqueios`),metric('Drift de fonte',num(s.driftSources||0),'mudanças detectadas',Number(s.driftSources||0)>0?'warning':'success'),metric('Respostas parciais',num(s.partialResponses||0),`${num(s.partialRecovered||0)} recuperadas`,Number(s.partialCritical||0)>0?'danger':'')].join('');
    renderDistribution('sourceDistribution',d.source); renderDistribution('cacheDistribution',d.cache); renderDistribution('appDistribution',[...normalizeDistribution(d.apps),...normalizeDistribution(d.channels)]);
    const actions=[]; if(Number(s.blockedSources||0)>0)actions.push(action('Fontes bloqueadas',`${num(s.blockedSources)} ocorrências exigem revisão de fallback.`,'danger')); if(Number(s.driftSources||0)>0)actions.push(action('Mudança estrutural detectada',`${num(s.driftSources)} fontes apresentaram drift.`,'warning')); if(Number(s.partialCritical||0)>0)actions.push(action('Resposta parcial crítica',`${num(s.partialCritical)} respostas chegaram sem dados essenciais.`,'danger')); if(Number(s.cacheMisses||0)>Number(s.cacheHits||0)&&Number(s.responses||0)>10)actions.push(action('Baixo reaproveitamento',`Misses ${num(s.cacheMisses)} contra ${num(s.cacheHits)} hits.`,'warning')); if(!actions.length)actions.push(action('Fontes estáveis','Nenhum bloqueio ou drift crítico foi observado nesta janela.','success')); $('sourceActions').innerHTML=actions.join('');
  }

  function renderHealth() {
    const s=summary(); const memoryAlert=Boolean(s.memoryPressureAlert||s.memoryPressure?.alert); $('healthMetrics').innerHTML=[metric('Health score',`${num(s.healthScore??100)}%`,String(s.operationalState||'saudável').replaceAll('_',' '),Number(s.healthScore??100)<80?'warning':'success'),metric('Disponibilidade',`${num(s.availabilityPercent??100)}%`,`alvo ${num(s.sloAvailabilityTargetPercent??99)}%`,Number(s.availabilityPercent??100)<Number(s.sloAvailabilityTargetPercent??99)?'danger':'success'),metric('Apdex',num(s.apdexScore??100),'satisfação por latência',Number(s.apdexScore??100)<80?'warning':'success'),metric('Qualidade',`${num(s.dataQualityScore??100)}%`,`contrato ${num(s.contractScore??100)}%`,Number(s.dataQualityScore??100)<85?'warning':'success'),metric('Pressão runtime',`${num(s.runtimePressureScore??100)}%`,`RSS ${num(s.memoryRssMb||0)} MB`,memoryAlert?'danger':'success')].join('');
    const actions=[]; if(Number(s.errors||0)>0)actions.push(action('Erros recentes',`${num(s.errors)} respostas com falha; abra a lista abaixo.`,'danger')); if(s.latencyAlertEligible&&Number(s.p95LatencyMs||0)>Number(s.sloP95TargetMs||2500))actions.push(action('p95 acima do SLO',`${ms(s.p95LatencyMs)} para alvo ${ms(s.sloP95TargetMs)}.`,'warning')); if(memoryAlert)actions.push(action('Pressão de memória',s.memoryPressure?.reason||'A instância ultrapassou o limite de alerta.','danger')); if(Number(s.captureGap||0)>0)actions.push(action('Captura incompleta',`${num(s.captureGap)} lacunas entre requisições e respostas.`,'warning')); if(!actions.length)actions.push(action('Sem alertas críticos','Disponibilidade, captura e runtime estão dentro dos limites observados.','success')); $('healthActions').innerHTML=actions.join('');
    const i=state.data?.instance||{}; const v=state.data?.vercelRuntime||{}; $('runtimeFacts').innerHTML=facts([['Ambiente',v.env||state.data?.serverless?.mode||'—'],['Região',v.region||'—'],['Node.js',i.node||'—'],['Uptime',age(i.uptimeSeconds||0)],['RSS',bytes(i.memory?.rss||0)],['Heap / limite V8',`${bytes(i.memory?.heapUsed||0)} / ${num(summary().heapSizeLimitMb||0)} MB`],['PID',i.pid||'—'],['Instância',i.id||'—']]);
    const errors=state.events.filter(event=>Number(event.status||0)>=400||event.aborted||event.clientClosed).slice(0,30); $('errorCount').textContent=num(errors.length); $('errorList').innerHTML=errors.length?errors.map(event=>`<a class="error-row" href="${ROUTES.request}?event=${encodeURIComponent(eventId(event))}" data-event-link="${esc(eventId(event))}"><time>${esc(time(event.at))}</time><strong class="status-code ${toneForStatus(event.status,event)}">${esc(event.status||'—')}</strong><code>${esc(`${event.method||'GET'} ${event.route||'/'}`)}</code><span>${esc(event.errorCode||event.sourceStatus||event.outcome||'falha observada')}</span><span>${esc(ms(event.latencyMs))}</span></a>`).join(''):empty('Nenhum erro ou cancelamento recente.');
  }

  function drawChart() {
    const canvas=$('trafficChart'); if(!canvas)return; const rect=canvas.getBoundingClientRect(); const ratio=Math.min(2,window.devicePixelRatio||1); canvas.width=Math.max(1,Math.floor(rect.width*ratio)); canvas.height=Math.max(1,Math.floor(220*ratio)); const ctx=canvas.getContext('2d'); ctx.scale(ratio,ratio); const w=rect.width,h=220; ctx.clearRect(0,0,w,h);
    const css=getComputedStyle(document.body); const line=css.getPropertyValue('--line').trim(); const muted=css.getPropertyValue('--muted').trim(); const accent=css.getPropertyValue('--accent').trim(); const info=css.getPropertyValue('--info').trim(); const danger=css.getPropertyValue('--danger').trim();
    ctx.strokeStyle=line;ctx.lineWidth=1;ctx.fillStyle=muted;ctx.font='10px system-ui'; for(let i=0;i<5;i++){const y=20+i*42;ctx.beginPath();ctx.moveTo(42,y);ctx.lineTo(w-8,y);ctx.stroke();}
    let series=timeSeries(); if(!series.length){series=Array.from({length:20},(_,index)=>({at:Date.now()-(19-index)*60000,requests:0,responses:0,errors:0}));}
    const rows=series.slice(-30); const max=Math.max(1,...rows.flatMap(row=>[Number(row.requests||row.requestCount||0),Number(row.responses||row.responseCount||0),Number(row.errors||row.errorCount||0)])); const x=index=>42+(w-54)*(rows.length<=1?0:index/(rows.length-1)); const y=value=>190-(Number(value||0)/max)*160;
    [['requests',accent],['responses',info],['errors',danger]].forEach(([key,color])=>{ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();rows.forEach((row,index)=>{const value=row[key]??row[`${key.slice(0,-1)}Count`]??0;if(index===0)ctx.moveTo(x(index),y(value));else ctx.lineTo(x(index),y(value));});ctx.stroke();}); ctx.fillStyle=muted;ctx.fillText('0',18,194);ctx.fillText(String(max),12,34);
  }

  function renderDiagnostics() {
    const s=summary(); const p=state.data?.monitorPersistence||{}; const serverless=state.data?.serverless||{}; $('captureFacts').innerHTML=facts([['Interceptor central',s.centralInterceptorInstalled?'instalado':'ausente',s.centralInterceptorInstalled?'success':'danger'],['Completude',`${num(s.captureCompletenessPercent??100)}%`,Number(s.captureGap||0)>0?'warning':'success'],['Lacunas',num(s.captureGap||0)],['Leituras internas isoladas',num(s.internalTelemetryRequests||0)],['Eventos disponíveis',num(s.eventsAvailable??state.events.length)],['Último tráfego externo',s.lastExternalEventAt?dateTime(s.lastExternalEventAt):'não observado']]);
    $('persistenceFacts').innerHTML=facts([['Modo','memory','success'],['Persistência remota','desativada','success'],['Supabase do monitor','não utilizado','success'],['Retenção','por instância serverless'],['Polling sugerido',`${num((serverless.pollingHintMs||30000)/1000)} s`],['Fila de persistência',num(p.queueDepth||0)]]);
    const raw=state.data?JSON.stringify(state.data,null,2):'Aguardando dados.'; $('rawSnapshot').textContent=raw; $('snapshotSize').textContent=state.data?bytes(new Blob([raw]).size):'—';
  }

  function renderArchitecture() {
    const bp=state.data?.monitorBlueprint||{}; const c=bp.counters||{}; const s=summary(); $('architectureMetrics').innerHTML=[metric('Rotas rastreadas',num(c.routesTracked??s.routesTracked??0),'tráfego externo'),metric('Payloads observados',num(c.observedPayloads??state.data?.payloadIntelligence?.observedPayloads??0),'preview limitado'),metric('Séries gráficas',num(c.totalChartSeriesObserved??s.payloadTotalChartSeriesObserved??0),'entregues ao APK'),metric('Bytes enviados',bytes(c.bytesOut??s.bytesOut??0),'volume da instância')].join('');
    const flow=Array.isArray(bp.dataFlow)?bp.dataFlow:[]; $('architectureFlow').innerHTML=flow.length?flow.map((item,index)=>`<article class="flow-step"><span>${String(item.step||index+1).padStart(2,'0')}</span><strong>${esc(item.title||'Etapa')}</strong><small>${esc(`${item.input||'entrada'} → ${item.output||'saída'}`)}</small></article>`).join(''):['APK','Gateway','Cache e contratos','Fontes','Resposta observada'].map((title,index)=>`<article class="flow-step"><span>${String(index+1).padStart(2,'0')}</span><strong>${esc(title)}</strong><small>${esc(index===4?'Telemetria somente em memória':'Camada operacional do V-Proxy')}</small></article>`).join('');
    const controls=[...(bp.securityControls||[]),...(bp.resilienceControls||[])]; $('architectureControls').innerHTML=controls.length?controls.slice(0,18).map((text,index)=>action(index<(bp.securityControls||[]).length?'Segurança':'Resiliência',text,index<(bp.securityControls||[]).length?'info':'success')).join(''):action('Controles aguardando','O mapa será preenchido após a primeira coleta.','info');
    const contracts=bp.contracts||[]; $('architectureContracts').innerHTML=contracts.length?contracts.map(item=>`<div class="contract-item"><strong>${esc(item.name||'Contrato')}</strong><code>${esc(item.route||'—')}</code><span>${esc(`${item.input||'entrada'} → ${item.output||'saída'}`)}</span></div>`).join(''):empty('Contratos não disponíveis no snapshot.');
  }

  async function loadBenchmark() { try { const response=await fetch(BENCHMARK_URL,{cache:'no-store'}); if(!response.ok)throw new Error(`HTTP ${response.status}`); state.benchmark=await response.json(); state.benchmarkError=''; } catch(error){state.benchmarkError=error?.message||'falha';} renderBenchmark(); }
  function benchmarkRows() { const run=state.benchmark?.currentRun||{}; if(state.benchmarkScenario==='browser')return Array.isArray(run.browser?.results)?run.browser.results:[]; return Array.isArray(run[state.benchmarkScenario])?run[state.benchmarkScenario]:[]; }
  function renderBenchmark() {
    const data=state.benchmark; if(!data){$('benchmarkStatus').textContent=state.benchmarkError?`falha: ${state.benchmarkError}`:'carregando medições';$('benchmarkLeaderboard').innerHTML=empty('Benchmark ainda não disponível.');return;}
    const scenario=data.scenarios?.[state.benchmarkScenario]||{}; const rows=benchmarkRows().slice().sort((a,b)=>Number(a.averageMs||Infinity)-Number(b.averageMs||Infinity)); const valid=rows.filter(row=>row.parityWithParse5!==false&&row.parityWithParse5!==null); const best=valid[0]||rows[0]; $('benchmarkStatus').textContent=`medido em ${dateTime(data.generatedAt)}`; $('benchmarkScenarioTitle').textContent=scenario.title||state.benchmarkScenario; $('benchmarkScenarioDescription').textContent=scenario.description||'Cenário medido localmente.';
    $('benchmarkMetrics').innerHTML=[metric('Melhor latência',best?ms(best.averageMs):'—',best?.engine||'sem medição','success'),metric('Maior throughput',best?`${num(best.operationsPerSecond)} op/s`:'—','entre saídas comparáveis'),metric('Motores medidos',num(rows.length),'neste cenário'),metric('Paridade confirmada',num(rows.filter(row=>row.parityWithParse5===true).length),'fingerprint igual ao baseline')].join('');
    $('benchmarkLeaderboard').innerHTML=rows.length?rows.map((row,index)=>`<div class="benchmark-row"><span class="benchmark-rank">${index+1}</span><div class="benchmark-engine"><strong>${esc(row.engine)}</strong><small>${row.parityWithParse5===true?'paridade confirmada':row.parityWithParse5===false?'saída divergente':'não comparável'}</small></div><div class="benchmark-value"><span>Latência</span><strong>${esc(ms(row.averageMs))}</strong></div><div class="benchmark-value"><span>Throughput</span><strong>${esc(`${num(row.operationsPerSecond)} op/s`)}</strong></div><div class="benchmark-value"><span>Saída</span><strong>${esc(bytes(row.resultBytes||0))}</strong></div></div>`).join(''):empty('Nenhuma medição disponível para este cenário.');
    const m=data.methodology||{}; const run=data.currentRun||{}; $('benchmarkFacts').innerHTML=facts([['Comando',data.command||'npm run benchmark:scraping'],['Fixture',m.fixture||`${num(run.htmlBytes||0)} bytes`],['Rede incluída',m.networkIncluded?'sim':'não'],['Warmups',run.warmups??m.warmups??'—'],['Iterações',run.iterations??'—'],['Baseline',m.baseline||'—'],['Regra de paridade',m.parityRule||'—'],['Caveat',m.caveat||'—']]);
    $$('#benchmarkScenarioTabs [data-benchmark-scenario]').forEach(button=>{const active=button.dataset.benchmarkScenario===state.benchmarkScenario;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
  }

  function renderSettings() {
    $('pollInterval').value=String(state.pollMs); $('feedLimit').value=String(state.feedLimit); $('apiBaseInput').value=apiBase();
    const mode=themeMode(); const palette=colorTheme(); const density=densityMode(); const motion=reducedMotionMode();
    $$('[data-theme-mode]').forEach(button=>{const active=button.dataset.themeMode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    $$('button[data-color-theme]').forEach(button=>{const active=button.dataset.colorTheme===palette;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    $$('[data-density]').forEach(button=>{const active=button.dataset.density===density;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    $$('[data-motion]').forEach(button=>{const active=button.dataset.motion===motion;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    const theme=COLOR_THEMES[palette]||COLOR_THEMES.gold; $('themePreviewTitle').textContent=`${theme.label} · ${THEME_MODES[mode]||THEME_MODES.system}`; $('themePreviewDescription').textContent=`Material 3 ${density==='compact'?'compacto':'confortável'} · movimento ${motion==='reduced'?'reduzido':'padrão'} · preferência salva somente neste navegador.`;
    const node=$('settingsState'); node.className='status-banner neutral'; node.innerHTML=`<span class="status-dot"></span><div><strong>Monitor somente em memória</strong><small>${esc(`${apiBase()||location.origin} · ${state.paused?'polling pausado':`atualização a cada ${state.pollMs/1000}s`} · nenhuma telemetria gravada no Supabase`)}</small></div>`;
  }

  function themeMode(){const current=storage.get(STORAGE.themeMode,'')||storage.get(STORAGE.theme,'system');return Object.hasOwn(THEME_MODES,current)?current:'system';}
  function colorTheme(){const current=storage.get(STORAGE.colorTheme,'gold');return Object.hasOwn(COLOR_THEMES,current)?current:'gold';}
  function densityMode(){return storage.get(STORAGE.density,'comfortable')==='compact'?'compact':'comfortable';}
  function reducedMotionMode(){return storage.get(STORAGE.reducedMotion,'standard')==='reduced'?'reduced':'standard';}
  function matchMediaDark(){return window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;}
  function resolvedTheme(mode=themeMode()){return mode==='system'?(matchMediaDark()?.matches?'dark':'light'):mode;}
  function applyAppearance({mode=themeMode(),palette=colorTheme(),density=densityMode(),motion=reducedMotionMode()}={}){
    if(!Object.hasOwn(THEME_MODES,mode))mode='system';if(!Object.hasOwn(COLOR_THEMES,palette))palette='gold';density=density==='compact'?'compact':'comfortable';motion=motion==='reduced'?'reduced':'standard';
    storage.set(STORAGE.themeMode,mode);storage.set(STORAGE.colorTheme,palette);storage.set(STORAGE.density,density);storage.set(STORAGE.reducedMotion,motion);storage.remove(STORAGE.theme);
    const resolved=resolvedTheme(mode);document.body.dataset.theme=resolved;document.body.dataset.colorTheme=palette;document.body.dataset.density=density;document.body.dataset.reducedMotion=motion;document.documentElement.style.colorScheme=resolved;
    const theme=COLOR_THEMES[palette];const meta=$('themeColorMeta');if(meta)meta.setAttribute('content',resolved==='dark'?'#000000':'#ECEEF2');const toggle=$('themeToggle');toggle.setAttribute('aria-pressed',String(resolved==='dark'));toggle.setAttribute('aria-label',resolved==='dark'?'Ativar modo claro':'Ativar modo escuro');toggle.title=toggle.getAttribute('aria-label');
    renderSettings();if(state.view==='health')requestAnimationFrame(drawChart);
  }
  function applyTheme(mode){applyAppearance({mode});}
  function applyColorTheme(palette){applyAppearance({palette});}
  function quickToggleTheme(){applyAppearance({mode:resolvedTheme()==='dark'?'light':'dark'});}
  function normalizeApiBase(value){const raw=String(value||'').trim();if(!raw)return'';const parsed=new URL(raw);if(!['http:','https:'].includes(parsed.protocol))throw new Error('Use uma origem HTTP ou HTTPS.');if(parsed.username||parsed.password)throw new Error('A origem não pode conter usuário ou senha.');if(parsed.search||parsed.hash)throw new Error('Remova parâmetros e fragmentos da origem.');const path=parsed.pathname.replace(/\/+$/,'');return`${parsed.origin}${path==='/'?'':path}`;}

  function routeFromLocation(){const hash=location.hash.replace(/^#/,'');if(hash)return HASH_ALIASES[hash]||hash;const path=location.pathname.replace(/\/+$/,'')||'/';if(path==='/monitor'||path==='/'||path==='/server'||path==='/server.html')return'overview';const item=Object.entries(ROUTES).find(([,route])=>route===path); if (item) return item[0]; return path.startsWith('/monitor/requests') ? 'request' : 'overview';}
  function urlFor(view, options={}){const base=ROUTES[view]||ROUTES.overview;if(view==='request'&&options.event)return`${base}?event=${encodeURIComponent(options.event)}`;return base;}
  function navigate(view,{replace=false,event=null,focus=true}={}){if(!ROUTES[view])view='overview';if(event)state.selectedId=event;state.view=view;storage.set(STORAGE.view,view);const target=urlFor(view,{event:state.selectedId});if(location.pathname+location.search!==target)history[replace?'replaceState':'pushState']({view},'',target);renderView(focus);}
  function renderView(focus=true){$$('[data-view-panel]').forEach(panel=>{const active=panel.dataset.viewPanel===state.view;panel.hidden=!active;panel.classList.toggle('active',active);});$$('[data-nav]').forEach(link=>{const active=link.dataset.nav===state.view||(state.view==='request'&&link.dataset.nav==='traffic');link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});renderHeader();if(state.view==='request')renderRequest();if(state.view==='health')requestAnimationFrame(drawChart);closeMenu();if(focus)$(`[data-view-panel="${state.view}"]`)?.focus({preventScroll:true});}

  function openMenu(){state.menuOpen=true;$('appSidebar')?.classList.add('open');$('menuBackdrop')?.classList.add('open');$('menuButton')?.setAttribute('aria-expanded','true');}
  function closeMenu(){state.menuOpen=false;$('appSidebar')?.classList.remove('open');$('menuBackdrop')?.classList.remove('open');$('menuButton')?.setAttribute('aria-expanded','false');}
  function setPause(){
    const button=$('pauseButton');
    if(!button) return;
    button.classList.toggle('is-paused',state.paused);
    button.setAttribute('aria-pressed',String(state.paused));
    const span = button.querySelector('span');
    if (span) span.textContent=state.paused?'Retomar':'Pausar';
    button.setAttribute('aria-label',state.paused?'Retomar atualização automática':'Pausar atualização automática');
  }
  function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function csvValue(value){let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text=`'${text}`;return`"${text.replaceAll('"','""')}"`;}
  function exportEvents(format){const events=state.filtered.length?state.filtered:state.events.slice(0,state.feedLimit);const stamp=new Date().toISOString().replace(/[:.]/g,'-');if(format==='json')download(`valorae-proxy-events-${stamp}.json`,JSON.stringify({releasePatch:state.data?.releasePatch||RELEASE_PATCH,generatedAt:new Date().toISOString(),events},null,2),'application/json');else{const columns=['at','method','route','status','latencyMs','bytesIn','bytesOut','appName','appChannel','ticker','view','cacheStatus','sourceStatus','requestId'];download(`valorae-proxy-events-${stamp}.csv`,[columns.join(','),...events.map(event=>columns.map(column=>csvValue(event[column])).join(','))].join('\n'),'text/csv;charset=utf-8');}}
  async function copyText(text,message){try{if(navigator.clipboard?.writeText&&window.isSecureContext)await navigator.clipboard.writeText(text);else{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();if(!document.execCommand('copy'))throw new Error('copy');area.remove();}toast(message);}catch{toast('Não foi possível copiar neste navegador.');}}

  function bindEvents(){
    document.addEventListener('click',event=>{
      const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();navigate(nav.dataset.nav);return;}
      const eventButton=event.target.closest('[data-event-id]');if(eventButton){navigate('request',{event:eventButton.dataset.eventId});return;}
      const eventLink=event.target.closest('[data-event-link]');if(eventLink){event.preventDefault();navigate('request',{event:eventLink.dataset.eventLink});}
    });
    on('menuButton','click',openMenu);on('menuCloseButton','click',closeMenu);on('menuBackdrop','click',closeMenu);on('refreshButton','click',()=>refresh({manual:true}));
    on('pauseButton','click',()=>{state.paused=!state.paused;setPause();if(state.paused){clearTimeout(state.timer);state.controller?.abort();setConnection('stale','Pausado');}else refresh({manual:true});renderSettings();});
    on('themeToggle','click',quickToggleTheme);$$('[data-theme-mode]').forEach(button=>on(button,'click',()=>applyAppearance({mode:button.dataset.themeMode})));$$('button[data-color-theme]').forEach(button=>on(button,'click',()=>applyAppearance({palette:button.dataset.colorTheme})));$$('[data-density]').forEach(button=>on(button,'click',()=>applyAppearance({density:button.dataset.density})));$$('[data-motion]').forEach(button=>on(button,'click',()=>applyAppearance({motion:button.dataset.motion})));
    for(const id of['feedSearch','statusFilter','methodFilter','appFilter']) on(id, id==='feedSearch'?'input':'change', renderTraffic);
    on('clearFilters','click',()=>{if($('feedSearch'))$('feedSearch').value='';if($('statusFilter'))$('statusFilter').value='all';if($('methodFilter'))$('methodFilter').value='all';if($('appFilter'))$('appFilter').value='all';renderTraffic();});
    on('routeSearch','input',renderRoutes);
    on('copyEventButton','click',()=>{const event=selectedEvent();if(event)copyText(JSON.stringify(event,null,2),'Evento copiado.');});on('copySnapshotButton','click',()=>state.data&&copyText(JSON.stringify(state.data,null,2),'Snapshot copiado.'));on('exportJsonButton','click',()=>exportEvents('json'));on('exportCsvButton','click',()=>exportEvents('csv'));
    $$('#benchmarkScenarioTabs [data-benchmark-scenario]').forEach(button=>on(button,'click',()=>{state.benchmarkScenario=button.dataset.benchmarkScenario;renderBenchmark();}));on('copyBenchmarkCommand','click',()=>copyText(state.benchmark?.command||'npm run benchmark:scraping','Comando copiado.'));
    on('pollInterval','change',()=>{const val = $('pollInterval')?.value; if(val != null){state.pollMs=bounded(val,30000,15000,120000);storage.set(STORAGE.poll,String(state.pollMs));schedule();renderSettings();}});
    on('feedLimit','change',()=>{const val = $('feedLimit')?.value; if(val != null){state.feedLimit=bounded(val,60,30,100);storage.set(STORAGE.feedLimit,String(state.feedLimit));renderTraffic();renderSettings();}});
    on('saveApiBase','click',()=>{try{const val = $('apiBaseInput')?.value || ''; const raw=normalizeApiBase(val);storage.set(STORAGE.apiBase,raw);state.data=null;state.events=[];toast('Origem atualizada.');refresh({manual:true});}catch(error){toast(error?.message||'Origem inválida.');}});
    on('clearApiBase','click',()=>{storage.remove(STORAGE.apiBase);if($('apiBaseInput'))$('apiBaseInput').value='';state.data=null;state.events=[];toast('Monitorando a origem atual.');refresh({manual:true});});
    on('resetPreferences','click',()=>{Object.values(STORAGE).forEach(key=>storage.remove(key));state.pollMs=30000;state.feedLimit=60;state.paused=false;setPause();applyAppearance({mode:'system',palette:'gold',density:'comfortable',motion:'standard'});navigate('overview');renderSettings();toast('Preferências restauradas.');refresh({manual:true});});
    window.addEventListener('popstate',()=>{state.selectedId=new URL(location.href).searchParams.get('event');state.view=routeFromLocation();renderView(false);});window.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.menuOpen)closeMenu();});window.addEventListener('resize',()=>{if(state.view==='health')requestAnimationFrame(drawChart);});window.addEventListener('online',()=>refresh({manual:true}));window.addEventListener('offline',()=>setConnection('offline','Sem rede'));document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!state.paused)refresh({manual:true});});matchMediaDark()?.addEventListener?.('change',()=>{if(themeMode()==='system')applyAppearance({mode:'system'});});
  }

  function init(){applyAppearance();bindEvents();setPause();if($('pollInterval'))$('pollInterval').value=String(state.pollMs);if($('feedLimit'))$('feedLimit').value=String(state.feedLimit);state.selectedId=new URL(location.href).searchParams.get('event');state.view=routeFromLocation();if(!ROUTES[state.view])state.view=storage.get(STORAGE.view,'overview');navigate(state.view,{replace:true,event:state.selectedId,focus:false});renderSettings();loadBenchmark();refresh({manual:true});if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('/service-worker.js').catch(()=>{});}
  init();
})();
