(() => {
  'use strict';

  const RELEASE_PATCH = '21.12.382-quote-state-resilience-v350';
  const STORAGE = {
    theme: 'valorae:monitor:theme',
    apiBase: 'valorae:monitor:apiBase',
    poll: 'valorae:monitor:pollMs',
    feedLimit: 'valorae:monitor:feedLimit',
    view: 'valorae:monitor:view',
  };
  const VIEW_ALIASES = {
    command: 'live', output: 'live', feed: 'live', overview: 'live',
    performance: 'health', quality: 'health', diagnostics: 'health',
    benchmarks: 'benchmark', comparison: 'benchmark', compare: 'benchmark',
    integration: 'architecture', io: 'architecture', technology: 'architecture', system: 'architecture',
  };
  const PAGE_TITLES = {
    live: 'Ao vivo',
    routes: 'Rotas e fontes',
    health: 'Saúde',
    benchmark: 'Benchmark',
    architecture: 'Arquitetura',
    settings: 'Ajustes',
  };
  const BENCHMARK_DATA_URL = '/assets/valorae-monitor-benchmarks.json';

  const $ = id => document.getElementById(id);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const safeStorage = {
    get(key, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} },
    remove(key) { try { localStorage.removeItem(key); } catch {} },
  };
  const state = {
    data: null,
    events: [],
    filteredEvents: [],
    selectedId: null,
    paused: false,
    loading: false,
    timer: null,
    requestController: null,
    pollMs: boundedNumber(safeStorage.get(STORAGE.poll, '3000'), 3000, 2000, 10000),
    feedLimit: boundedNumber(safeStorage.get(STORAGE.feedLimit, '60'), 60, 30, 80),
    view: 'live',
    lastSuccessAt: 0,
    error: '',
    rawRenderedAt: '',
    benchmark: null,
    benchmarkError: '',
    benchmarkLoading: false,
    benchmarkScenario: 'complex',
    architectureNode: 'apk',
    menuOpen: false,
    menuReturnFocus: null,
  };
  let toastTimer;

  function boundedNumber(value, fallback, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(number) : '—';
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  function formatMs(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return number >= 1000 ? `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)} s` : `${Math.round(number)} ms`;
  }

  function formatTime(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDateTime(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  }

  function formatAge(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    if (value < 60) return `${Math.round(value)} s`;
    if (value < 3600) return `${Math.floor(value / 60)} min`;
    return `${Math.floor(value / 3600)} h ${Math.floor((value % 3600) / 60)} min`;
  }

  function compactId(value, length = 12) {
    const text = String(value || '—');
    return text.length > length ? `${text.slice(0, length)}…` : text;
  }

  function apiBase() {
    return String(safeStorage.get(STORAGE.apiBase, '') || '').replace(/\/$/, '');
  }

  function apiUrl(path) {
    return `${apiBase()}${path}`;
  }

  function compactRelease(value) {
    const release = String(value || RELEASE_PATCH);
    const semantic = release.match(/(?:^|-)v(\d+)(?:$|[-.])/i);
    return semantic ? `Proxy v${semantic[1]}` : release;
  }

  function normalizeApiBase(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use uma origem HTTP ou HTTPS.');
    if (parsed.username || parsed.password) throw new Error('A origem não pode conter usuário ou senha.');
    if (parsed.search || parsed.hash) throw new Error('Remova parâmetros e fragmentos da origem.');
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${pathname === '/' ? '' : pathname}`;
  }

  function monitorAnalytics() {
    const analytics = state.data?.monitorAnalytics;
    return analytics?.active ? analytics : null;
  }

  function observedSummary() {
    return monitorAnalytics()?.summary || state.data?.summary || {};
  }

  function metric(label, value, note = '', tone = '') {
    return `<div class="metric-item"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value ${tone ? `tone-${tone}` : ''}">${escapeHtml(value)}</strong><span class="metric-note">${escapeHtml(note)}</span></div>`;
  }

  function facts(entries) {
    return entries.map(([label, value, tone = '']) => `<div><dt>${escapeHtml(label)}</dt><dd class="${tone ? `tone-${tone}` : ''}">${escapeHtml(value ?? '—')}</dd></div>`).join('');
  }

  function toast(message) {
    const node = $('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
  }

  function statusTone(status) {
    const code = Number(status || 0);
    if (code >= 400 || code === 0) return 'error';
    if (code >= 300) return 'redirect';
    return 'success';
  }

  function eventIdentity(event) {
    return String(event?.eventKey ?? event?.id ?? `${event?.at || ''}-${event?.route || ''}-${event?.requestId || ''}`);
  }

  function setConnection(kind, label) {
    const node = $('connectionState');
    if (!node) return;
    node.className = `connection ${kind || ''}`;
    const text = node.querySelector('span');
    if (text) text.textContent = label;
  }

  function schedule() {
    clearTimeout(state.timer);
    if (state.paused) return;
    state.timer = setTimeout(() => refresh(), state.pollMs);
  }

  async function refresh({ manual = false } = {}) {
    if (state.loading) {
      if (manual) toast('Uma atualização já está em andamento.');
      return;
    }
    if (state.paused && !manual) return;
    if (document.hidden && !manual) {
      schedule();
      return;
    }
    state.loading = true;
    $('refreshButton')?.classList.add('is-loading');
    $('refreshButton')?.setAttribute('aria-busy', 'true');
    $('monitorMain')?.setAttribute('aria-busy', 'true');
    state.requestController?.abort();
    const controller = new AbortController();
    state.requestController = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);
    if (!state.data) setConnection('', 'Conectando');
    try {
      const response = await fetch(apiUrl('/api/server/metrics'), {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-Valorae-App': 'VALORAE Proxy Monitor',
          'X-Valorae-Channel': 'dashboard',
          'X-Valorae-Telemetry': 'dashboard',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || data.ok === false) throw new Error(data?.error || 'Snapshot inválido');
      state.data = data;
      state.events = Array.isArray(data.proxyOutputMonitor?.outputFeed)
        ? data.proxyOutputMonitor.outputFeed
        : Array.isArray(data.recentEvents) ? data.recentEvents : [];
      state.lastSuccessAt = Date.now();
      state.error = '';
      if (!state.selectedId || !state.events.some(event => eventIdentity(event) === state.selectedId)) {
        state.selectedId = state.events[0] ? eventIdentity(state.events[0]) : null;
      }
      setConnection('online', state.paused ? 'Pausado' : 'Ao vivo');
      renderAll();
    } catch (error) {
      if (timedOut) state.error = 'Tempo limite de 12 s ao consultar as métricas';
      else if (error?.name !== 'AbortError' || manual) state.error = error?.message || 'Falha de conexão';
      if (state.data) setConnection('stale', timedOut ? 'Tempo limite' : 'Dados anteriores');
      else setConnection('offline', timedOut ? 'Tempo limite' : 'Sem conexão');
      renderHeader();
    } finally {
      clearTimeout(timeout);
      state.loading = false;
      $('refreshButton')?.classList.remove('is-loading');
      $('refreshButton')?.setAttribute('aria-busy', 'false');
      $('monitorMain')?.setAttribute('aria-busy', 'false');
      if (state.requestController === controller) state.requestController = null;
      schedule();
    }
  }

  function clearRemoteSnapshot() {
    state.data = null;
    state.events = [];
    state.filteredEvents = [];
    state.selectedId = null;
    state.rawRenderedAt = '';
    renderAll();
  }

  function renderAll() {
    renderHeader();
    renderLive();
    renderRoutes();
    renderHealth();
    renderBenchmark();
    renderArchitecture();
    renderSettings();
    if (state.view === 'health') requestAnimationFrame(drawTrafficChart);
  }

  function renderHeader() {
    const data = state.data;
    const summary = data?.summary || {};
    if ($('currentPageLabel')) $('currentPageLabel').textContent = PAGE_TITLES[state.view] || PAGE_TITLES.live;
    const fullRelease = data?.releasePatch || RELEASE_PATCH;
    if ($('releaseLabel')) {
      $('releaseLabel').textContent = compactRelease(fullRelease);
      $('releaseLabel').title = fullRelease;
    }
    if ($('drawerReleaseLabel')) $('drawerReleaseLabel').textContent = `${compactRelease(fullRelease)} · UI v356`;
    if ($('instanceLabel')) $('instanceLabel').textContent = data?.instance?.id ? `instância ${compactId(data.instance.id, 8)}` : 'instância —';
    if ($('updatedLabel')) $('updatedLabel').textContent = state.error
      ? `falha: ${state.error}`
      : state.lastSuccessAt ? `atualizado ${formatTime(state.lastSuccessAt)}` : 'aguardando dados';
    if ($('liveDescription') && data) {
      const stateText = String(summary.trafficState || 'aguardando').replaceAll('_', ' ');
      const analytics = monitorAnalytics();
      const persistent = Number(summary.persistentEventsStored || 0);
      const analyzed = Number(analytics?.eventCount || 0);
      $('liveDescription').textContent = `${stateText} · ${formatNumber(summary.responses || 0)} respostas nesta instância${analyzed ? ` · ${formatNumber(analyzed)} analisadas na janela persistida` : ''}${persistent ? ` · ${formatNumber(persistent)} armazenadas no Supabase` : ''}.`;
    }
  }

  function renderLive() {
    const data = state.data;
    if (!data) {
      $('liveMetrics').innerHTML = Array.from({ length: 6 }, (_, index) => metric(['Requisições', 'Respostas', 'Em voo', 'Erros', 'Latência p95', 'Dados enviados'][index], '—', 'aguardando')).join('');
      $('captureLine').className = 'capture-line';
      $('captureLine').innerHTML = '<span class="capture-state"><i aria-hidden="true"></i><strong>Captura aguardando</strong></span><span>Conectando ao endpoint de métricas do Proxy.</span>';
      renderInflight([]);
      populateFeedFilters();
      renderFeed();
      $('retentionNote').textContent = 'A retenção será informada após a conexão.';
      return;
    }
    const summary = data.summary || {};
    const localSummary = summary;
    const analytics = monitorAnalytics();
    const observed = analytics?.summary || summary;
    const latencyTone = (observed.p95LatencyMs || 0) > (observed.sloP95TargetMs || 2500) && observed.latencyAlertEligible ? 'warning' : '';
    $('liveMetrics').innerHTML = [
      metric('Requisições', formatNumber(summary.requests || 0), `${formatNumber(summary.requestsPerMinute1m || 0)}/min nesta instância`),
      metric('Respostas analisadas', formatNumber(observed.responses || 0), analytics ? `${formatNumber(summary.responses || 0)} nesta instância · janela persistida` : `${formatNumber(observed.successRatePercent ?? 100)}% sucesso`, (observed.errorRatePercent || 0) > 5 ? 'warning' : 'success'),
      metric('Em voo', formatNumber(summary.inFlight || 0), summary.oldestActiveRoute || 'nenhuma pendência', summary.inFlight ? 'info' : ''),
      metric('Erros', formatNumber(observed.errors || 0), `${formatNumber(observed.errorRatePercent || 0)}% da janela`, observed.errors ? 'danger' : 'success'),
      metric('Latência p95', formatMs(observed.p95LatencyMs), `${formatNumber(observed.measuredLatencySamples || 0)} amostras · confiança ${observed.latencyConfidence || '—'}`, latencyTone),
      metric('Dados enviados', formatBytes(observed.bytesOut || 0), `p95 ${formatBytes(observed.payloadP95BytesOut || 0)}`),
    ].join('');
    renderCapture(data);
    renderInflight(data.activeRequests || []);
    populateFeedFilters();
    renderFeed();
    const scope = data.proxyOutputMonitor?.scope;
    $('retentionNote').textContent = scope?.persistence || `Até ${formatNumber(localSummary.eventsStored || state.events.length)} eventos na memória desta instância.`;
  }

  function renderCapture(data) {
    const summary = data.summary || {};
    const localSummary = summary;
    const percent = Number(localSummary.captureCompletenessPercent ?? 100);
    const gap = Number(localSummary.captureGap || 0);
    const kind = gap > 0 || percent < 95 ? 'degraded' : percent < 100 ? 'attention' : 'complete';
    const line = $('captureLine');
    line.className = `capture-line ${kind}`;
    line.innerHTML = `<span class="capture-state"><i aria-hidden="true"></i><strong>${escapeHtml(percent >= 100 && !gap ? 'Captura central íntegra' : 'Captura requer atenção')}</strong></span><span>${escapeHtml(`${formatNumber(percent)}% · ${formatNumber(summary.responses || 0)} eventos · ${formatNumber(gap)} lacunas · ${formatNumber(localSummary.internalTelemetryRequests || 0)} leituras internas isoladas`)}</span>`;
  }

  function renderInflight(activeRequests) {
    const section = $('inflightSection');
    const list = Array.isArray(activeRequests) ? activeRequests : [];
    section.hidden = list.length === 0;
    $('inflightCount').textContent = formatNumber(list.length);
    $('inflightList').innerHTML = list.map(item => `<div class="inflight-row"><strong>${escapeHtml(`${item.method || 'GET'} ${item.route || '/'}`)}</strong><span>${escapeHtml(`${item.appName || item.device || 'Consumidor'} · ${formatMs(item.ageMs || 0)} · ${formatBytes(item.bytesIn || 0)} recebidos`)}</span></div>`).join('');
  }

  function populateFeedFilters() {
    const methods = [...new Set(state.events.map(event => String(event.method || 'GET').toUpperCase()))].sort();
    const apps = [...new Set(state.events.map(event => String(event.appName || event.device || 'Consumidor API')))].sort((a, b) => a.localeCompare(b));
    replaceSelectOptions($('methodFilter'), [['all', 'Todos os métodos'], ...methods.map(value => [value, value])]);
    replaceSelectOptions($('appFilter'), [['all', 'Todos os consumidores'], ...apps.map(value => [value, value])]);
  }

  function replaceSelectOptions(select, entries) {
    if (!select) return;
    const previous = select.value || 'all';
    const signature = entries.map(entry => entry.join(':')).join('|');
    if (select.dataset.signature !== signature) {
      select.innerHTML = entries.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
      select.dataset.signature = signature;
    }
    select.value = entries.some(([value]) => value === previous) ? previous : 'all';
  }

  function filteredEvents() {
    const search = String($('feedSearch')?.value || '').trim().toLowerCase();
    const status = $('statusFilter')?.value || 'all';
    const method = $('methodFilter')?.value || 'all';
    const app = $('appFilter')?.value || 'all';
    return state.events.filter(event => {
      const code = Number(event.status || 0);
      if (status === 'success' && !(code >= 200 && code < 400)) return false;
      if (status === 'error' && code < 400) return false;
      if (status === 'slow' && !event.slow && Number(event.latencyMs || 0) < 2500) return false;
      if (status === 'aborted' && !event.aborted && !event.clientClosed && code !== 499) return false;
      if (method !== 'all' && String(event.method || '').toUpperCase() !== method) return false;
      const eventApp = String(event.appName || event.device || 'Consumidor API');
      if (app !== 'all' && eventApp !== app) return false;
      if (!search) return true;
      const haystack = [event.route, event.ticker, event.view, eventApp, event.appChannel, event.sourceStatus, event.cacheStatus, event.requestId, ...(event.queryKeys || [])].join(' ').toLowerCase();
      return haystack.includes(search);
    }).slice(0, state.feedLimit);
  }

  function renderFeed() {
    const focusedEventId = document.activeElement?.dataset?.eventId || null;
    state.filteredEvents = filteredEvents();
    $('feedCount').textContent = `${formatNumber(state.filteredEvents.length)} de ${formatNumber(state.events.length)} eventos`;
    if (!state.filteredEvents.length) {
      $('eventFeed').innerHTML = `<div class="empty-copy">${state.events.length ? 'Nenhum evento corresponde aos filtros.' : 'Aguardando a primeira resposta externa desta instância.'}</div>`;
      renderEventDetail();
      return;
    }
    $('eventFeed').innerHTML = state.filteredEvents.map(event => {
      const id = eventIdentity(event);
      const selected = id === state.selectedId;
      const tone = statusTone(event.status);
      const source = event.sourceStatus && event.sourceStatus !== 'unknown' ? event.sourceStatus : 'fonte —';
      const cache = event.cacheStatus && event.cacheStatus !== 'unknown' ? event.cacheStatus : 'cache —';
      const flags = [
        event.ticker ? `<span class="flag">${escapeHtml(event.ticker)}</span>` : '',
        `<span class="flag">${escapeHtml(source)}</span>`,
        `<span class="flag">${escapeHtml(cache)}</span>`,
        event.partial?.detected ? `<span class="flag${event.partial.classification === 'critical' ? ' danger' : ''}">parcial ${escapeHtml(event.partial.classification || '')}</span>` : '',
        event.aborted || event.clientClosed ? '<span class="flag danger">cancelada</span>' : event.slow ? '<span class="flag danger">lenta</span>' : '',
      ].filter(Boolean).join('');
      const accessibleLabel = `${event.method || 'GET'} ${event.route || '/'}, status ${event.status || 'não informado'}, ${formatMs(event.latencyMs)}`;
      return `<button class="event-row${selected ? ' selected' : ''}" type="button" data-event-id="${escapeHtml(id)}" aria-pressed="${selected}" aria-label="${escapeHtml(accessibleLabel)}"><time class="event-time" datetime="${escapeHtml(event.at || '')}">${escapeHtml(formatTime(event.at))}</time><span class="event-main"><span class="event-route"><span class="method">${escapeHtml(event.method || 'GET')}</span><strong>${escapeHtml(event.route || '/')}</strong></span><span class="event-consumer">${escapeHtml(`${event.appName || event.device || 'Consumidor API'}${event.appChannel ? ` · ${event.appChannel}` : ''}`)}</span></span><span class="event-delivery"><strong class="status-code ${tone}">${escapeHtml(event.status || '—')}</strong><small>${escapeHtml(`${formatMs(event.latencyMs)} · ${formatBytes(event.bytesOut)}`)}</small><span class="event-flags">${flags}</span></span></button>`;
    }).join('');
    $$('.event-row').forEach(button => button.addEventListener('click', () => {
      state.selectedId = button.dataset.eventId;
      renderFeed();
    }));
    if (focusedEventId) {
      const focusedReplacement = $$('.event-row').find(button => button.dataset.eventId === focusedEventId);
      focusedReplacement?.focus({ preventScroll: true });
    }
    renderEventDetail();
  }

  function selectedEvent() {
    return state.events.find(event => eventIdentity(event) === state.selectedId) || null;
  }

  function renderEventDetail() {
    const event = selectedEvent();
    const copyButton = $('copyEventButton');
    copyButton.disabled = !event;
    if (!event) {
      $('detailTitle').textContent = 'Selecione uma resposta';
      $('eventDetailBody').className = 'empty-copy';
      $('eventDetailBody').textContent = 'O detalhe mostra entrada, saída, origem, cache, contrato e uma prévia limitada do payload entregue.';
      return;
    }
    $('detailTitle').textContent = `${event.method || 'GET'} ${event.status || '—'}`;
    $('eventDetailBody').className = '';
    const queryEntries = Object.entries(event.safeQuery || {});
    const queryText = queryEntries.length ? queryEntries.map(([key, value]) => `${key}=${value}`).join(' · ') : (event.queryKeys || []).join(', ') || 'sem parâmetros visíveis';
    const roots = Array.isArray(event.payloadRoots) ? event.payloadRoots : [];
    const signals = event.payloadSignals && typeof event.payloadSignals === 'object' ? event.payloadSignals : {};
    $('eventDetailBody').innerHTML = `
      <div class="detail-block"><p class="detail-route">${escapeHtml(event.route || '/')}</p><div class="detail-subline"><span>${escapeHtml(formatDateTime(event.at))}</span><span>request ${escapeHtml(event.requestId || 'não informado')}</span><span>${escapeHtml(event.interceptor || 'interceptor —')}</span></div></div>
      <dl class="fact-list">${facts([
        ['Consumidor', event.appName || event.device || 'Consumidor API'],
        ['Canal / versão', [event.appChannel, event.appVersion, event.appBuild].filter(Boolean).join(' · ') || '—'],
        ['Entrada', `${formatBytes(event.bytesIn || 0)} · ${event.requestContentType || 'sem body'}`],
        ['Parâmetros', queryText],
        ['Ticker / view', [event.ticker, event.view].filter(Boolean).join(' · ') || '—'],
        ['Resposta', `${event.status || '—'} · ${event.contentType || 'tipo não informado'}`, Number(event.status || 0) >= 400 ? 'danger' : 'success'],
        ['Latência', formatMs(event.latencyMs), event.slow ? 'warning' : ''],
        ['Saída', formatBytes(event.bytesOut || 0)],
        ['Fonte', event.sourceStatus || 'unknown'],
        ['Cache', event.cacheStatus || 'unknown'],
        ['Parcial', event.partial?.detected ? `${event.partial.classification || 'degraded'} · ${event.partial.reason || 'sem motivo classificado'}` : 'não'],
        ['Entrega', event.deliveryDecision || event.payloadKind || '—'],
        ['Região / host', [event.platform?.region, event.platform?.host].filter(Boolean).join(' · ') || '—'],
      ])}</dl>
      <div class="detail-block"><h3>Raízes entregues</h3><div class="chip-line">${roots.length ? roots.map(root => `<span class="chip">${escapeHtml(root)}</span>`).join('') : '<span class="empty-copy">Nenhuma raiz JSON identificada.</span>'}</div></div>
      <div class="detail-block"><h3>Sinais do contrato</h3><pre>${escapeHtml(JSON.stringify(signals, null, 2) || '{}')}</pre></div>
      <div class="detail-block"><h3>Prévia segura do payload</h3><pre>${escapeHtml(prettyPayload(event.payloadPreview))}</pre></div>`;
  }

  function prettyPayload(payload) {
    if (payload === undefined || payload === null || payload === '') return 'Sem corpo ou prévia indisponível.';
    if (typeof payload !== 'string') return JSON.stringify(payload, null, 2);
    try { return JSON.stringify(JSON.parse(payload), null, 2); } catch { return payload; }
  }

  function renderRoutes() {
    const data = state.data;
    if (!data) {
      $('routeMetrics').innerHTML = Array.from({ length: 6 }, (_, index) => metric(['Rotas observadas', 'Clientes ativos', 'Cache hit', 'Fonte confiável', 'Entrada', 'Saída'][index], '—', 'aguardando')).join('');
      $('routeCount').textContent = '0 rotas';
      $('routeTable').innerHTML = '<tr><td colspan="7">Conectando ao inventário de rotas.</td></tr>';
      renderDistribution('sourceDistribution', [], 'Aguardando fontes');
      renderDistribution('cacheDistribution', [], 'Aguardando cache');
      renderDistribution('appDistribution', [], 'Aguardando consumidores');
      return;
    }
    const localSummary = data.summary || {};
    const analytics = monitorAnalytics();
    const summary = analytics?.summary || localSummary;
    const routes = analytics?.routeDetails || (Array.isArray(data.routeDetails) ? data.routeDetails : []);
    const distributions = analytics?.distributions || data.distributions || {};
    $('routeMetrics').innerHTML = [
      metric('Rotas observadas', formatNumber(summary.routesTracked || routes.length), analytics ? 'janela persistida' : 'instância atual'),
      metric('Clientes ativos', formatNumber(localSummary.activeClients5m || 0), 'estado atual · últimos 5 minutos'),
      metric('Cache hit', `${formatNumber(summary.cacheHitRatePercent || 0)}%`, `${formatNumber(summary.cacheHits || 0)} hits classificados`),
      metric('Fonte confiável', `${formatNumber(summary.sourceReliabilityScore ?? 100)}/100`, `${formatNumber(summary.partialCritical || 0)} parciais críticas`, (summary.sourceReliabilityScore ?? 100) < 80 ? 'warning' : 'success'),
      metric('Entrada', formatBytes(summary.bytesIn || 0), `média ${formatBytes(summary.avgBytesIn || 0)}`),
      metric('Saída', formatBytes(summary.bytesOut || 0), `p95 ${formatBytes(summary.payloadP95BytesOut || 0)}`),
    ].join('');
    renderRouteTable(routes);
    renderDistribution('sourceDistribution', distributions.source || [], 'Nenhuma fonte identificada');
    renderDistribution('cacheDistribution', distributions.cache || [], 'Cache ainda não observado');
    const apps = [...(distributions.apps || []).map(item => ({ ...item, name: `App · ${item.name}` })), ...(distributions.channels || []).map(item => ({ ...item, name: `Canal · ${item.name}` }))];
    renderDistribution('appDistribution', apps, 'Nenhum consumidor identificado');
  }

  function renderRouteTable(routes) {
    const search = String($('routeSearch')?.value || '').trim().toLowerCase();
    const filtered = routes.filter(route => !search || [route.route, route.topSource, route.topCache, route.topApp, route.topChannel].join(' ').toLowerCase().includes(search));
    $('routeCount').textContent = `${formatNumber(filtered.length)} rotas`;
    $('routeTable').innerHTML = filtered.length ? filtered.map(route => `<tr><td>${escapeHtml(route.route || '—')}<span class="cell-sub">${escapeHtml(route.topMethod || 'GET')} · último ${escapeHtml(formatTime(route.lastSeenAt))}</span></td><td><span class="cell-main">${escapeHtml(`${formatNumber(route.responses || 0)} respostas`)}</span><span class="cell-sub">${escapeHtml(`${formatNumber(route.partialCritical || 0)} críticas · ${formatNumber(route.partialDegraded || 0)} degradadas`)}</span></td><td><span class="cell-main ${route.errorRatePercent ? 'tone-danger' : 'tone-success'}">${escapeHtml(`${formatNumber(route.successRatePercent ?? 100)}% sucesso`)}</span><span class="cell-sub">${escapeHtml(`${formatNumber(route.errors || 0)} erros`)}</span></td><td><span class="cell-main">p95 ${escapeHtml(formatMs(route.p95LatencyMs))}</span><span class="cell-sub">${escapeHtml(`${formatNumber(route.latencySamples || route.responses || 0)} amostras · ${route.latencyConfidence || '—'}`)}</span></td><td><span class="cell-main">p95 ${escapeHtml(formatBytes(route.payloadP95BytesOut || route.avgBytesOut || 0))}</span><span class="cell-sub">${escapeHtml(`média ${formatBytes(route.avgBytesOut || 0)} · ${formatNumber(route.payloadSamples || route.responses || 0)} amostras`)}</span></td><td><span class="cell-main">${escapeHtml(route.topSource || route.lastSourceStatus || '—')}</span><span class="cell-sub">${escapeHtml(route.topCache || route.lastCacheStatus || '—')}</span></td><td><span class="cell-main">${escapeHtml(route.topApp || route.topDevice || '—')}</span><span class="cell-sub">${escapeHtml(route.topChannel || 'canal —')}</span></td></tr>`).join('') : '<tr><td colspan="7">Nenhuma rota corresponde ao filtro.</td></tr>';
  }

  function renderDistribution(id, items, emptyMessage) {
    const node = $(id);
    const list = Array.isArray(items) ? items.filter(item => item && Number(item.value || 0) > 0).slice(0, 12) : [];
    if (!list.length) {
      node.innerHTML = `<div class="empty-copy">${escapeHtml(emptyMessage)}</div>`;
      return;
    }
    const max = Math.max(...list.map(item => Number(item.value || 0)), 1);
    node.innerHTML = list.map(item => `<div class="distribution-row"><span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span><span class="distribution-bar"><i style="width:${Math.max(2, (Number(item.value || 0) / max) * 100)}%"></i></span><strong>${escapeHtml(formatNumber(item.value))}</strong></div>`).join('');
  }

  function renderHealth() {
    const data = state.data;
    if (!data) {
      $('healthMetrics').innerHTML = Array.from({ length: 6 }, (_, index) => metric(['Saúde da instância', 'Disponibilidade', 'Latência p95', 'Qualidade dos dados', 'Heap / limite V8', 'SLO'][index], '—', 'aguardando')).join('');
      renderPlainList('alertList', [], item => item);
      renderPlainList('runbookList', [], item => item);
      $('captureFacts').innerHTML = facts([['Estado', 'aguardando conexão']]);
      $('runtimeFacts').innerHTML = facts([['Estado', 'aguardando conexão']]);
      $('errorCount').textContent = '0';
      $('errorList').innerHTML = '<div class="empty-copy">Aguardando o feed de erros.</div>';
      $('rawSnapshot').textContent = 'Abra após a conexão para carregar o JSON.';
      return;
    }
    const localSummary = data.summary || {};
    const summary = observedSummary();
    const heap = Number(localSummary.heapLimitUsagePercent || localSummary.heapUsagePercent || 0);
    const latencyWarning = (summary.p95LatencyMs || 0) > (summary.sloP95TargetMs || 2500) && summary.latencyAlertEligible;
    $('healthMetrics').innerHTML = [
      metric('Saúde da instância', `${formatNumber(localSummary.healthScore ?? 100)}/100`, localSummary.operationalState || 'aguardando', (localSummary.healthScore ?? 100) < 75 ? 'danger' : (localSummary.healthScore ?? 100) < 88 ? 'warning' : 'success'),
      metric('Disponibilidade', `${formatNumber(summary.availabilityPercent ?? 100)}%`, `${formatNumber(summary.responses || 0)} respostas analisadas`, (summary.availabilityPercent ?? 100) < (summary.sloAvailabilityTargetPercent || 99) ? 'danger' : 'success'),
      metric('Latência p95', formatMs(summary.p95LatencyMs), `${formatNumber(summary.measuredLatencySamples || 0)} amostras · confiança ${summary.latencyConfidence || '—'}`, latencyWarning ? 'warning' : ''),
      metric('Qualidade dos dados', `${formatNumber(summary.dataQualityScore ?? 100)}/100`, `${formatNumber(summary.partialCritical || 0)} críticas · ${formatNumber(summary.partialRecovered || 0)} recuperadas`, (summary.dataQualityScore ?? 100) < 75 ? 'danger' : (summary.dataQualityScore ?? 100) < 88 ? 'warning' : 'success'),
      metric('Heap / limite V8', `${formatNumber(heap)}%`, `${formatNumber(localSummary.heapUsedMb || 0)} de ${formatNumber(localSummary.heapSizeLimitMb || 0)} MB`, localSummary.memoryPressureAlert ? 'warning' : ''),
      metric('SLO', String(localSummary.sloStatus || '—').replaceAll('_', ' '), `${formatNumber(localSummary.errorBudgetRemainingPercent ?? 100)}% orçamento restante`, (localSummary.errorBudgetRemainingPercent ?? 100) < 30 ? 'warning' : ''),
    ].join('');
    renderPlainList('alertList', data.insights || [], item => ({ level: item.level, title: item.title, text: item.description }));
    renderPlainList('runbookList', data.operations?.runbook || [], item => ({ level: item.level, title: item.action, text: item.detail }));
    $('captureFacts').innerHTML = facts([
      ['Cobertura', `${formatNumber(localSummary.captureCompletenessPercent ?? 100)}%`, (localSummary.captureCompletenessPercent ?? 100) < 99 ? 'warning' : 'success'],
      ['Lacunas', formatNumber(localSummary.captureGap || 0), localSummary.captureGap ? 'danger' : 'success'],
      ['sendJson', formatNumber(localSummary.interceptedBySendJson || 0)],
      ['Diretas / stream', formatNumber(localSummary.interceptedByResEnd || 0)],
      ['HEAD / bodyless', `${formatNumber(localSummary.headResponses || 0)} / ${formatNumber(localSummary.bodylessResponses || 0)}`],
      ['Polling interno', formatNumber(localSummary.internalTelemetryRequests || 0)],
      ['Eventos na instância', formatNumber(localSummary.eventsStored || 0)],
      ['Histórico disponível', formatNumber(localSummary.eventsAvailable || state.events.length)],
      ['Persistidos no Supabase', formatNumber(localSummary.persistentEventsStored || 0), localSummary.historyPersistenceActive ? 'success' : 'warning'],
      ['Janela analisada', formatNumber(monitorAnalytics()?.eventCount || localSummary.eventsStored || 0)],
    ]);
    const runtime = data.vercelRuntime || {};
    $('runtimeFacts').innerHTML = facts([
      ['Ambiente', runtime.env || data.instance?.platform || 'local'],
      ['Região', runtime.observed?.lastRegion || runtime.region || 'local'],
      ['Host', runtime.observed?.lastHost || runtime.url || '—'],
      ['Node.js', data.instance?.node || '—'],
      ['Uptime', formatAge(data.instance?.uptimeSeconds || 0)],
      ['Instância', data.instance?.id || '—'],
      ['RSS', formatBytes(data.instance?.memory?.rss || 0)],
    ]);
    renderErrors();
    if ($('rawDetails').open) renderRawSnapshot();
  }

  function renderPlainList(id, items, mapper) {
    const node = $(id);
    const list = Array.isArray(items) ? items.slice(0, 10) : [];
    node.innerHTML = list.length ? list.map(raw => {
      const item = mapper(raw);
      const level = item.level === 'error' ? 'error' : item.level === 'warn' ? 'warning' : item.level === 'ok' ? 'ok' : 'info';
      return `<div class="plain-row ${level}"><i aria-hidden="true"></i><div><strong>${escapeHtml(item.title || 'Informação')}</strong><span>${escapeHtml(item.text || '')}</span></div></div>`;
    }).join('') : '<div class="empty-copy">Nenhum sinal disponível.</div>';
  }

  function renderErrors() {
    const errors = state.events.filter(event => Number(event.status || 0) >= 400 || event.aborted || event.clientClosed).slice(0, 40);
    $('errorCount').textContent = formatNumber(errors.length);
    $('errorList').innerHTML = errors.length ? errors.map(event => `<div class="error-row"><time>${escapeHtml(formatTime(event.at))}</time><strong class="tone-${Number(event.status || 0) >= 500 ? 'danger' : 'warning'}">${escapeHtml(event.status || '—')}</strong><code title="${escapeHtml(event.route || '')}">${escapeHtml(event.route || '/')}</code><span>${escapeHtml(event.sourceStatus || event.deliveryDecision || '—')}</span><span>${escapeHtml(formatMs(event.latencyMs))}</span></div>`).join('') : '<div class="empty-copy">Nenhum erro ou cancelamento no feed recente.</div>';
  }

  function drawTrafficChart() {
    const canvas = $('trafficChart');
    if (!canvas || state.view !== 'health') return;
    const series = monitorAnalytics()?.timeSeries || state.data?.timeSeries;
    const data = Array.isArray(series) ? series.slice(-60) : [];
    const width = Math.max(320, canvas.clientWidth || 800);
    const height = 190;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const styles = getComputedStyle(document.body);
    const line = styles.getPropertyValue('--line').trim();
    const muted = styles.getPropertyValue('--muted').trim();
    const accent = styles.getPropertyValue('--accent').trim();
    const success = styles.getPropertyValue('--success').trim();
    const danger = styles.getPropertyValue('--danger').trim();
    if (data.length < 2) {
      context.fillStyle = muted;
      context.font = '12px system-ui';
      context.fillText('Aguardando série temporal suficiente.', 4, 28);
      return;
    }
    const padding = { top: 16, right: 6, bottom: 24, left: 34 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maximum = Math.max(1, ...data.flatMap(point => [Number(point.requests || 0), Number(point.responses || 0), Number(point.errors || 0)]));
    context.strokeStyle = line;
    context.lineWidth = 1;
    for (let index = 0; index <= 3; index += 1) {
      const y = padding.top + (chartHeight * index / 3);
      context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
    }
    const plot = (key, color) => {
      context.strokeStyle = color;
      context.lineWidth = key === 'errors' ? 1.4 : 1.8;
      context.beginPath();
      data.forEach((point, index) => {
        const x = padding.left + (chartWidth * index / Math.max(1, data.length - 1));
        const y = padding.top + chartHeight - (Number(point[key] || 0) / maximum) * chartHeight;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    };
    plot('requests', accent); plot('responses', success); plot('errors', danger);
    context.fillStyle = muted;
    context.font = '10px system-ui';
    context.fillText(String(maximum), 3, padding.top + 3);
    context.fillText('0', 22, padding.top + chartHeight + 3);
  }

  function renderRawSnapshot() {
    if (!state.data) return;
    const generatedAt = state.data.generatedAt || String(state.lastSuccessAt);
    if (state.rawRenderedAt === generatedAt) return;
    $('rawSnapshot').textContent = JSON.stringify(state.data, null, 2);
    state.rawRenderedAt = generatedAt;
  }

  async function loadBenchmarkData({ force = false } = {}) {
    if (state.benchmarkLoading || (state.benchmark && !force)) return;
    state.benchmarkLoading = true;
    state.benchmarkError = '';
    renderBenchmark();
    try {
      const response = await fetch(`${BENCHMARK_DATA_URL}${force ? `?t=${Date.now()}` : ''}`, { cache: force ? 'no-store' : 'default' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload?.currentRun?.complex || !payload?.currentRun?.simple) throw new Error('Dataset incompleto');
      state.benchmark = payload;
    } catch (error) {
      state.benchmarkError = error?.message || 'Falha ao carregar benchmark';
    } finally {
      state.benchmarkLoading = false;
      renderBenchmark();
    }
  }

  function percentReduction(fasterMs, baselineMs) {
    const faster = Number(fasterMs || 0);
    const baseline = Number(baselineMs || 0);
    if (!(faster > 0 && baseline > 0)) return 0;
    return Math.max(0, (1 - faster / baseline) * 100);
  }

  function multiplier(value, baseline) {
    const current = Number(value || 0);
    const base = Number(baseline || 0);
    return current > 0 && base > 0 ? current / base : 0;
  }

  function engineCatalogEntry(name) {
    const id = String(name || '');
    const aliases = {
      'parse5-direct-simple': 'parse5-direct-css-select',
      'htmlparser2-direct-simple': 'htmlparser2-direct-css-select',
      'cheerio-parse5-simple': 'cheerio-parse5',
      'cheerio-htmlparser2-simple': 'cheerio-htmlparser2',
    };
    const target = aliases[id] || id;
    return (state.benchmark?.engineCatalog || []).find(item => item.id === target) || null;
  }

  function engineLabel(name) {
    const catalog = engineCatalogEntry(name);
    if (catalog?.label) return catalog.label;
    const labels = {
      'valorae-hybrid-force-parse5': 'VALORAE · Parse5 forçado',
      'valorae-css-lite-legacy': 'VALORAE · CSS Lite legado',
      'playwright-chromium-dom': 'Playwright · Chromium',
    };
    return labels[name] || String(name || 'Motor');
  }

  function benchmarkScenarioEntries(scenario) {
    const run = state.benchmark?.currentRun || {};
    if (scenario === 'simple') return Array.isArray(run.simple) ? run.simple : [];
    if (scenario === 'browser') {
      const browser = Array.isArray(run.browser?.results) ? run.browser.results.map(item => ({ ...item, capabilityComparable: true })) : [];
      const hybrid = (run.complex || []).find(item => item.engine === 'valorae-hybrid-adaptive');
      return hybrid ? [...browser, { ...hybrid, engine: 'valorae-hybrid-adaptive', referenceOnly: true, capabilityComparable: false, note: 'Referência de parser estático: não executa JavaScript.' }] : browser;
    }
    return Array.isArray(run.complex) ? run.complex : [];
  }

  function benchmarkScenarioText(scenario) {
    const data = state.benchmark?.scenarios?.[scenario] || {};
    return {
      title: data.title || 'Cenário',
      description: data.description || 'Medição local reproduzível.',
      capability: data.capability || 'Capacidade não informada',
      bestMetric: data.bestMetric || 'Menor latência entre saídas equivalentes.',
    };
  }

  function benchmarkParity(item) {
    if (item.referenceOnly || item.capabilityComparable === false) return { label: 'capacidade diferente', tone: 'reference' };
    if (item.parityWithParse5 === true) return { label: 'saída equivalente', tone: 'ok' };
    if (item.parityWithParse5 === false) return { label: 'saída divergente', tone: 'partial' };
    return { label: 'não comparável', tone: 'partial' };
  }

  function renderBenchmarkLeaderboard() {
    const node = $('benchmarkLeaderboard');
    const intro = $('benchmarkScenarioIntro');
    if (!node || !intro) return;
    const scenario = state.benchmarkScenario;
    const info = benchmarkScenarioText(scenario);
    const entries = benchmarkScenarioEntries(scenario);
    intro.innerHTML = `<div><span class="eyebrow">${escapeHtml(info.title)}</span><strong>${escapeHtml(info.capability)}</strong><p>${escapeHtml(info.description)}</p></div><small>${escapeHtml(info.bestMetric)}</small>`;
    if (!entries.length) {
      node.innerHTML = '<div class="empty-copy">Não há medição disponível para este cenário.</div>';
      return;
    }
    const ranked = [...entries].sort((a, b) => {
      if (Boolean(a.referenceOnly) !== Boolean(b.referenceOnly)) return a.referenceOnly ? 1 : -1;
      if ((a.parityWithParse5 === true) !== (b.parityWithParse5 === true)) return a.parityWithParse5 === true ? -1 : 1;
      return Number(a.averageMs || Infinity) - Number(b.averageMs || Infinity);
    });
    const comparable = ranked.filter(item => !item.referenceOnly && item.parityWithParse5 === true);
    const maximum = Math.max(1, ...ranked.map(item => Number(item.averageMs || 0)));
    const winner = comparable[0]?.engine;
    let rank = 0;
    node.innerHTML = ranked.map(item => {
      const parity = benchmarkParity(item);
      const isComparable = !item.referenceOnly && item.parityWithParse5 === true;
      if (isComparable) rank += 1;
      const meta = engineCatalogEntry(item.engine) || {};
      const valorae = String(item.engine || '').startsWith('valorae-');
      const isWinner = item.engine === winner;
      const width = Math.max(2.5, Number(item.averageMs || 0) / maximum * 100);
      const badge = isWinner ? '<span class="benchmark-winner">melhor equivalente</span>' : item.referenceOnly ? '<span class="benchmark-reference">referência</span>' : '';
      return `<article class="benchmark-rank-row${valorae ? ' valorae' : ''}${item.referenceOnly ? ' reference-only' : ''}">
        <span class="benchmark-rank">${isComparable ? String(rank).padStart(2, '0') : '—'}</span>
        <div class="benchmark-engine-name"><span>${escapeHtml(meta.family || 'Motor')}</span><strong>${escapeHtml(engineLabel(item.engine))}</strong><small>${escapeHtml(meta.category || item.note || '')}</small></div>
        <div class="benchmark-rank-track"><i style="width:${width.toFixed(2)}%" aria-hidden="true"></i></div>
        <div class="benchmark-rank-metric"><strong>${escapeHtml(formatMs(item.averageMs))}</strong><small>${escapeHtml(`${formatNumber(item.operationsPerSecond)} op/s`)}</small></div>
        <div class="benchmark-rank-state"><span class="parity-state ${escapeHtml(parity.tone)}"><i></i>${escapeHtml(parity.label)}</span>${badge}</div>
      </article>`;
    }).join('');
  }

  function renderBenchmarkDecisionGrid() {
    const node = $('benchmarkDecisionGrid');
    if (!node || !state.benchmark) return;
    const run = state.benchmark.currentRun || {};
    const winner = entries => [...(entries || [])].filter(item => item.parityWithParse5 === true).sort((a, b) => Number(a.averageMs || Infinity) - Number(b.averageMs || Infinity))[0];
    const complexWinner = winner(run.complex);
    const simpleWinner = winner(run.simple);
    const browserWinner = winner(run.browser?.results);
    const cards = [
      ['HTML estático complexo', complexWinner, 'Equilíbrio entre compatibilidade e throughput.'],
      ['Extração simples', simpleWinner, 'Evita DOM completo quando o contrato permite.'],
      ['Página com JavaScript', browserWinner, 'Use browser somente quando a renderização for indispensável.'],
    ];
    node.innerHTML = cards.map(([title, item, note], index) => `<article><span>0${index + 1}</span><div><small>${escapeHtml(title)}</small><strong>${escapeHtml(item ? engineLabel(item.engine) : 'Não medido')}</strong><p>${escapeHtml(note)}</p></div><b>${escapeHtml(item ? formatMs(item.averageMs) : '—')}</b></article>`).join('');
  }

  function renderEngineCatalog() {
    const node = $('engineCatalog');
    if (!node || !state.benchmark) return;
    const catalog = Array.isArray(state.benchmark.engineCatalog) ? state.benchmark.engineCatalog : [];
    const measuredIds = new Set([
      ...(state.benchmark.currentRun?.complex || []),
      ...(state.benchmark.currentRun?.simple || []),
      ...(state.benchmark.currentRun?.browser?.results || []),
    ].map(item => engineCatalogEntry(item.engine)?.id || item.engine));
    node.innerHTML = catalog.map(item => {
      const measured = item.status === 'measured' && measuredIds.has(item.id);
      return `<article class="engine-tile ${measured ? 'measured' : 'reference'}"><header><span>${escapeHtml(item.family || 'Motor')}</span><b>${measured ? 'medido' : 'referência'}</b></header><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.category || '')}</p><dl><div><dt>Melhor uso</dt><dd>${escapeHtml(item.bestFor || '—')}</dd></div><div><dt>Vantagem</dt><dd>${escapeHtml(item.strength || '—')}</dd></div><div><dt>Limite</dt><dd>${escapeHtml(item.tradeoff || '—')}</dd></div></dl></article>`;
    }).join('');
  }

  function setBenchmarkScenario(scenario) {
    if (!['complex', 'simple', 'browser'].includes(scenario)) return;
    state.benchmarkScenario = scenario;
    $$('#benchmarkScenarioTabs [data-benchmark-scenario]').forEach(button => {
      const active = button.dataset.benchmarkScenario === scenario;
      button.setAttribute('aria-selected', String(active));
      button.classList.toggle('active', active);
    });
    renderBenchmarkLeaderboard();
  }

  function renderBenchmark() {
    const status = $('benchmarkStatus');
    if (!status) return;
    if (state.benchmarkLoading) status.textContent = 'carregando medições';
    else if (state.benchmarkError) status.textContent = `falha: ${state.benchmarkError}`;
    else if (state.benchmark) status.textContent = `execução real · ${state.benchmark.currentRun?.node || 'Node.js'}`;
    else status.textContent = 'evidência ainda não carregada';

    const metrics = $('benchmarkMetrics');
    if (!state.benchmark) {
      metrics.innerHTML = Array.from({ length: 6 }, (_, index) => metric(['Motores medidos', 'Cenários', 'Melhor complexo', 'Melhor simples', 'Browser', 'Paridade'][index], '—', state.benchmarkError || 'aguardando')).join('');
      $('benchmarkLeaderboard').innerHTML = '<div class="empty-copy">Aguardando dados de benchmark.</div>';
      $('benchmarkTable').innerHTML = '<tr><td colspan="7">Dataset ainda não carregado.</td></tr>';
      return;
    }

    const data = state.benchmark;
    const run = data.currentRun || {};
    const complex = Array.isArray(run.complex) ? run.complex : [];
    const simple = Array.isArray(run.simple) ? run.simple : [];
    const browser = Array.isArray(run.browser?.results) ? run.browser.results : [];
    const measured = [...complex, ...simple, ...browser];
    const uniqueMeasured = new Set(measured.map(item => engineCatalogEntry(item.engine)?.id || item.engine));
    const equivalent = measured.filter(item => item.parityWithParse5 === true).length;
    const winner = entries => [...entries].filter(item => item.parityWithParse5 === true).sort((a, b) => Number(a.averageMs || Infinity) - Number(b.averageMs || Infinity))[0] || {};
    const complexWinner = winner(complex);
    const simpleWinner = winner(simple);
    const browserWinner = winner(browser);
    const parse5 = complex.find(item => item.engine === 'parse5-direct-css-select') || {};
    const hybrid = complex.find(item => item.engine === 'valorae-hybrid-adaptive') || {};
    const reductionParse5 = percentReduction(hybrid.averageMs, parse5.averageMs);

    metrics.innerHTML = [
      metric('Motores medidos', formatNumber(uniqueMeasured.size), `${formatNumber((data.engineCatalog || []).length - uniqueMeasured.size)} referências sem número`),
      metric('Cenários', '3', 'estruturado · simples · browser'),
      metric('Melhor complexo', formatMs(complexWinner.averageMs), engineLabel(complexWinner.engine), 'success'),
      metric('Melhor simples', formatMs(simpleWinner.averageMs), engineLabel(simpleWinner.engine), 'success'),
      metric('Chromium DOM', formatMs(browserWinner.averageMs), run.browser?.available ? `startup ${formatMs(run.browser.startupMs)}` : 'não executado', run.browser?.available ? 'warning' : 'danger'),
      metric('Paridade', `${formatNumber(equivalent)}/${formatNumber(measured.length)}`, 'fingerprint por cenário', equivalent === measured.length ? 'success' : 'warning'),
    ].join('');

    $('benchmarkSummaryText').textContent = `No HTML estruturado, ${engineLabel(complexWinner.engine)} liderou entre as saídas equivalentes. O híbrido VALORAE ficou ${formatNumber(reductionParse5)}% abaixo da latência do Parse5 direto. Para páginas dependentes de JavaScript, o Chromium oferece outra capacidade e deve ser avaliado em uma faixa separada, não como substituto direto de um parser estático.`;
    renderBenchmarkDecisionGrid();
    renderBenchmarkLeaderboard();
    renderEngineCatalog();

    const rows = [
      ...complex.map(item => ({ ...item, scenario: 'HTML estruturado' })),
      ...simple.map(item => ({ ...item, scenario: 'Extração simples' })),
      ...browser.map(item => ({ ...item, scenario: 'DOM em navegador' })),
    ];
    $('benchmarkTable').innerHTML = rows.map(item => {
      const parity = benchmarkParity(item);
      const meta = engineCatalogEntry(item.engine) || {};
      return `<tr><td>${escapeHtml(engineLabel(item.engine))}<span class="cell-sub">${escapeHtml(item.engine)}</span></td><td>${escapeHtml(meta.family || '—')}</td><td>${escapeHtml(item.scenario)}</td><td><span class="cell-main">${escapeHtml(formatMs(item.averageMs))}</span><span class="cell-sub">total ${escapeHtml(formatMs(item.totalMs))}</span></td><td>${escapeHtml(formatNumber(item.operationsPerSecond))}</td><td><span class="parity-state ${escapeHtml(parity.tone)}"><i></i>${escapeHtml(parity.label)}</span></td><td>${escapeHtml(formatBytes(item.resultBytes || 0))}</td></tr>`;
    }).join('');
    $('benchmarkRunLabel').textContent = `${run.node || 'Node.js'} · ${formatNumber(run.iterations || 0)} iterações · ${formatNumber(uniqueMeasured.size)} motores`;
    $('benchmarkFacts').innerHTML = facts([
      ['Comando', data.command || '—'],
      ['Runtime', `${run.node || '—'} · ${run.platform || 'plataforma não informada'}`],
      ['HTML por operação', formatBytes(run.htmlBytes || 0)],
      ['Linhas da fixture', formatNumber(run.rows || 0)],
      ['Aquecimentos', formatNumber(run.warmups ?? data.methodology?.warmups ?? 0)],
      ['Baseline', data.methodology?.baseline || '—'],
      ['Rede incluída', data.methodology?.networkIncluded ? 'sim' : 'não'],
      ['Chromium', run.browser?.available ? `sim · startup ${formatMs(run.browser.startupMs)}` : `não · ${run.browser?.reason || 'indisponível'}`],
    ]);
    setBenchmarkScenario(state.benchmarkScenario);
  }

  const ARCHITECTURE_NODE_DETAILS = {
    apk: { eyebrow: 'Cliente mobile', title: 'APK VALORAE', summary: 'Consome contratos versionados e não conhece detalhes de scraping, provedores ou credenciais.', responsibilities: ['Envia versão e contexto do aplicativo', 'Define o contrato esperado', 'Recebe payload preparado para mobile'], risk: 'Uma mudança de formato sem compatibilidade quebra a interface.', protection: 'Gateway de contratos e testes cross-stack.' },
    router: { eyebrow: 'Camada de entrada', title: 'Edge + Router HTTP', summary: 'É a fronteira pública: recebe a requisição, aplica políticas e encaminha ao handler correto.', responsibilities: ['Normalização de rota e método', 'Headers de segurança e CORS', 'Limites, request ID e observabilidade inicial'], risk: 'Entrada inválida ou rota excessivamente cara.', protection: 'Validação antecipada e budgets por endpoint.' },
    contract: { eyebrow: 'Compatibilidade', title: 'Gateway de contratos', summary: 'Traduz a intenção do APK para operações internas sem expor a arquitetura de fornecedores.', responsibilities: ['Valida parâmetros e versão', 'Escolhe visão fast/full', 'Mantém shape render-safe'], risk: 'Regressão de campos entre versões.', protection: 'Schemas formais, aliases controlados e testes de integração.' },
    cache: { eyebrow: 'Eficiência', title: 'Cache + coalescing', summary: 'Evita repetir trabalho e mantém respostas úteis durante oscilações externas.', responsibilities: ['Cache fresco e stale seguro', 'Deduplicação de requisições em voo', 'Classificação de hit/miss/revalidated'], risk: 'Dados antigos ou avalanche de chamadas iguais.', protection: 'TTL por domínio, integridade do cache e coalescing.' },
    orchestrator: { eyebrow: 'Coordenação', title: 'Orquestrador paralelo', summary: 'Distribui tarefas independentes, controla prazos e decide o que pode degradar sem bloquear a entrega.', responsibilities: ['Budgets por bloco', 'Cancelamento e timeout', 'Composição progressiva fast/full'], risk: 'Uma fonte lenta consumir todo o prazo.', protection: 'Timeout isolado e fallback por producer.' },
    sources: { eyebrow: 'Integrações', title: 'APIs e fontes HTML', summary: 'Cada fornecedor fica atrás de um adaptador próprio para reduzir acoplamento e facilitar fallback.', responsibilities: ['Transporte HTTP resiliente', 'Headers e sessões por origem', 'Fallback multi-host e cache por fonte'], risk: 'Bloqueio, drift de HTML ou indisponibilidade.', protection: 'Canários, adaptadores isolados e fontes alternativas.' },
    scraping: { eyebrow: 'Extração', title: 'Scraping adaptativo', summary: 'Seleciona passagem única, DOM completo ou navegador conforme a complexidade e a necessidade de JavaScript.', responsibilities: ['Seletores simples em caminho rápido', 'Parse5/htmlparser2 para DOM estático', 'Browser somente quando indispensável'], risk: 'Usar browser caro em toda chamada ou parser leve em HTML incompatível.', protection: 'Classificação de seletor, benchmark e fallback explícito.' },
    normalize: { eyebrow: 'Integridade', title: 'Normalização + schema', summary: 'Converte resultados heterogêneos em um contrato estável, incluindo qualidade, cobertura e parcialidade.', responsibilities: ['Conversão de números e datas', 'Reconciliação de fontes', 'Validação de schema e cobertura'], risk: 'Apresentar dado parcial como completo.', protection: 'Metadados de cobertura, sourceStatus e rejeição de fallback inadequado.' },
    response: { eyebrow: 'Saída', title: 'Resposta ao APK', summary: 'Entrega o payload primeiro; persistência e telemetria seguem fora do caminho crítico.', responsibilities: ['Compressão e payload budget', 'ETag e cache HTTP', 'Captura pós-resposta para o monitor'], risk: 'A observabilidade aumentar a latência do usuário.', protection: 'after/waitUntil e isolamento do polling do monitor.' },
  };

  function renderArchitectureDetail(nodeId = state.architectureNode) {
    const node = $('architectureDetail');
    const detail = ARCHITECTURE_NODE_DETAILS[nodeId] || ARCHITECTURE_NODE_DETAILS.apk;
    if (!node) return;
    state.architectureNode = nodeId;
    $$('.architecture-node').forEach(button => {
      const active = button.dataset.architectureNode === nodeId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    node.innerHTML = `<span class="eyebrow">${escapeHtml(detail.eyebrow)}</span><h3>${escapeHtml(detail.title)}</h3><p>${escapeHtml(detail.summary)}</p><div class="architecture-detail-block"><strong>Responsabilidades</strong><ul>${detail.responsibilities.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="architecture-risk-grid"><div><span>Risco principal</span><p>${escapeHtml(detail.risk)}</p></div><div><span>Proteção</span><p>${escapeHtml(detail.protection)}</p></div></div>`;
  }

  function renderArchitecture() {
    if (!$('architectureMetrics')) return;
    const data = state.data;
    const summary = data?.summary || {};
    const analytics = monitorAnalytics();
    const persistence = data?.monitorPersistence || {};
    const runtime = data?.vercelRuntime || {};
    $('architectureMetrics').innerHTML = [
      metric('Contrato mobile', '1 gateway', '/api/v1/mobile/portfolio-sync'),
      metric('Rotas observadas', formatNumber((analytics?.summary || summary).routesTracked || 0), analytics ? 'janela persistida' : 'instância atual'),
      metric('Fontes', formatNumber((analytics?.distributions?.source || data?.distributions?.source || []).length), 'adaptadores e fallbacks'),
      metric('Cache hit', `${formatNumber((analytics?.summary || summary).cacheHitRatePercent || 0)}%`, 'classificado por resposta'),
      metric('Persistência', persistence.operational ? 'Supabase' : 'Memória', persistence.operational ? 'eventos pós-resposta' : 'instância efêmera', persistence.operational ? 'success' : 'warning'),
      metric('Runtime', data?.instance?.node || 'Node.js 24', runtime.env || data?.instance?.platform || 'Vercel'),
    ].join('');
    $('architectureRuntimeFacts').innerHTML = facts([
      ['Release', data?.releasePatch || RELEASE_PATCH],
      ['Ambiente', runtime.env || data?.instance?.platform || 'aguardando snapshot'],
      ['Região', runtime.observed?.lastRegion || runtime.region || '—'],
      ['Node.js', data?.instance?.node || '24.x declarado'],
      ['Instância', data?.instance?.id || '—'],
      ['Uptime', data ? formatAge(data.instance?.uptimeSeconds || 0) : '—'],
      ['Em voo', formatNumber(summary.inFlight || 0)],
    ]);
    $('architecturePersistenceFacts').innerHTML = facts([
      ['Modo', persistence.operational ? 'persistente' : 'efêmero', persistence.operational ? 'success' : 'warning'],
      ['Eventos no Supabase', formatNumber(summary.persistentEventsStored || 0)],
      ['Janela analítica', formatNumber(analytics?.eventCount || summary.eventsStored || 0)],
      ['Eventos da instância', formatNumber(summary.eventsStored || 0)],
      ['Escrita', 'pós-resposta'],
      ['Segredo', 'service_role somente no Proxy'],
      ['Estado instantâneo', 'heap, uptime e in-flight por instância'],
    ]);
    renderArchitectureDetail(state.architectureNode);
  }

  function drawerFocusableElements() {
    const drawer = $('appDrawer');
    if (!drawer) return [];
    return [...drawer.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.disabled && !element.hidden && element.getClientRects().length > 0);
  }

  function openMenu() {
    if (state.menuOpen) return;
    state.menuOpen = true;
    state.menuReturnFocus = document.activeElement;
    document.body.classList.add('menu-open');
    $('menuButton')?.setAttribute('aria-expanded', 'true');
    const drawer = $('appDrawer');
    if (drawer) {
      drawer.inert = false;
      drawer.setAttribute('aria-hidden', 'false');
    }
    $('monitorMain').inert = true;
    $('menuBackdrop')?.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => $('menuCloseButton')?.focus());
  }

  function closeMenu({ restoreFocus = true } = {}) {
    if (!state.menuOpen) return;
    state.menuOpen = false;
    document.body.classList.remove('menu-open');
    $('menuButton')?.setAttribute('aria-expanded', 'false');
    const drawer = $('appDrawer');
    if (drawer) {
      drawer.setAttribute('aria-hidden', 'true');
      drawer.inert = true;
    }
    $('monitorMain').inert = false;
    $('menuBackdrop')?.setAttribute('aria-hidden', 'true');
    if (restoreFocus && state.menuReturnFocus?.focus) state.menuReturnFocus.focus({ preventScroll: true });
    state.menuReturnFocus = null;
  }

  function trapMenuFocus(event) {
    if (!state.menuOpen || event.key !== 'Tab') return;
    const focusable = drawerFocusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderSettings() {
    if ($('apiBaseInput') && document.activeElement !== $('apiBaseInput')) $('apiBaseInput').value = apiBase();
    if ($('pollInterval')) $('pollInterval').value = String(state.pollMs);
    if ($('feedLimit')) $('feedLimit').value = String(state.feedLimit);
    const summary = state.data?.summary;
    if ($('settingsState')) {
      const persistence = state.data?.monitorPersistence || {};
      const analytics = monitorAnalytics();
      const persistenceText = persistence.operational ? `${formatNumber(summary?.persistentEventsStored || 0)} persistidos no Supabase · ${formatNumber(analytics?.eventCount || 0)} na janela analítica` : 'persistência somente em memória';
      $('settingsState').textContent = `${apiBase() || location.origin} · ${state.paused ? 'polling pausado' : `atualização a cada ${state.pollMs / 1000}s`} · ${persistenceText}.`;
    }
    renderThemeChoices();
  }

  function setView(rawView, { updateHash = true, focusPage = false } = {}) {
    const candidate = VIEW_ALIASES[rawView] || rawView || 'live';
    const view = ['live', 'routes', 'health', 'benchmark', 'architecture', 'settings'].includes(candidate) ? candidate : 'live';
    const wasMenuOpen = state.menuOpen;
    state.view = view;
    $$('[data-view]').forEach(button => {
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    let activePanel = null;
    $$('[data-view-panel]').forEach(panel => {
      const active = panel.dataset.viewPanel === view;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
      if (active) activePanel = panel;
    });
    safeStorage.set(STORAGE.view, view);
    if (updateHash) history.replaceState(null, '', `#${view}`);
    if ($('currentPageLabel')) $('currentPageLabel').textContent = PAGE_TITLES[view] || PAGE_TITLES.live;
    if (view === 'health') requestAnimationFrame(drawTrafficChart);
    if (view === 'benchmark') loadBenchmarkData();
    if (view === 'architecture') renderArchitecture();
    closeMenu({ restoreFocus: false });
    window.scrollTo({ top: 0, behavior: 'auto' });
    if ((focusPage || wasMenuOpen) && activePanel) requestAnimationFrame(() => activePanel.focus({ preventScroll: true }));
  }

  function themeMode() {
    return safeStorage.get(STORAGE.theme, 'system');
  }

  function applyTheme(mode = themeMode()) {
    const normalized = ['dark', 'light', 'system'].includes(mode) ? mode : 'system';
    safeStorage.set(STORAGE.theme, normalized);
    const resolved = normalized === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : normalized;
    document.body.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = resolved === 'light' ? '#fbfaf7' : '#0c0c0d';
    const toggle = $('themeToggle');
    if (toggle) {
      const next = resolved === 'dark' ? 'claro' : 'escuro';
      toggle.setAttribute('aria-label', `Usar tema ${next}`);
      toggle.setAttribute('title', `Usar tema ${next}`);
      toggle.setAttribute('aria-pressed', String(resolved === 'light'));
    }
    renderThemeChoices();
    if (state.view === 'health') requestAnimationFrame(drawTrafficChart);
  }

  function renderThemeChoices() {
    const mode = themeMode();
    $$('[data-theme]').forEach(button => {
      const active = button.dataset.theme === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvValue(value) {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportEvents(format) {
    const events = state.filteredEvents.length ? state.filteredEvents : state.events.slice(0, state.feedLimit);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'json') {
      downloadFile(`valorae-proxy-events-${stamp}.json`, JSON.stringify({ releasePatch: state.data?.releasePatch || RELEASE_PATCH, generatedAt: new Date().toISOString(), events }, null, 2), 'application/json');
    } else {
      const columns = ['at', 'method', 'route', 'status', 'latencyMs', 'bytesIn', 'bytesOut', 'appName', 'appChannel', 'ticker', 'view', 'cacheStatus', 'sourceStatus', 'requestId'];
      const csv = [columns.join(','), ...events.map(event => columns.map(column => csvValue(event[column])).join(','))].join('\n');
      downloadFile(`valorae-proxy-events-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
    }
  }

  async function copyText(text, message) {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        if (!copied) throw new Error('copy unsupported');
      }
      toast(message);
    } catch {
      toast('Não foi possível copiar neste navegador.');
    }
  }

  function setPauseState() {
    const button = $('pauseButton');
    if (!button) return;
    button.classList.toggle('is-paused', state.paused);
    button.setAttribute('aria-pressed', String(state.paused));
    button.setAttribute('aria-label', state.paused ? 'Retomar atualização automática' : 'Pausar atualização automática');
    button.setAttribute('title', state.paused ? 'Retomar atualização automática' : 'Pausar atualização automática');
    const text = button.querySelector('span');
    if (text) text.textContent = state.paused ? 'Retomar' : 'Pausar';
  }

  function bindEvents() {
    $$('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view, { focusPage: state.menuOpen })));
    $('menuButton').addEventListener('click', openMenu);
    $('menuCloseButton').addEventListener('click', () => closeMenu());
    $('menuBackdrop').addEventListener('click', () => closeMenu());
    $('refreshButton').addEventListener('click', () => refresh({ manual: true }));
    $('pauseButton').addEventListener('click', () => {
      state.paused = !state.paused;
      setPauseState();
      if (state.paused) {
        clearTimeout(state.timer);
        state.requestController?.abort();
        setConnection('stale', 'Pausado');
      } else {
        refresh({ manual: true });
      }
      renderSettings();
    });
    $('themeToggle').addEventListener('click', () => applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'));
    $$('[data-theme]').forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.theme)));
    for (const id of ['feedSearch', 'statusFilter', 'methodFilter', 'appFilter']) {
      $(id).addEventListener(id === 'feedSearch' ? 'input' : 'change', renderFeed);
    }
    $('clearFilters').addEventListener('click', () => {
      $('feedSearch').value = '';
      $('statusFilter').value = 'all';
      $('methodFilter').value = 'all';
      $('appFilter').value = 'all';
      renderFeed();
    });
    $('routeSearch').addEventListener('input', () => renderRouteTable(monitorAnalytics()?.routeDetails || state.data?.routeDetails || []));
    $('copyEventButton').addEventListener('click', () => {
      const event = selectedEvent();
      if (event) copyText(JSON.stringify(event, null, 2), 'Evento copiado.');
    });
    $('exportJsonButton').addEventListener('click', () => exportEvents('json'));
    $('exportCsvButton').addEventListener('click', () => exportEvents('csv'));
    $('copyBenchmarkCommand').addEventListener('click', () => copyText(state.benchmark?.command || 'npm run benchmark:scraping', 'Comando do benchmark copiado.'));
    $$('#benchmarkScenarioTabs [data-benchmark-scenario]').forEach(button => button.addEventListener('click', () => setBenchmarkScenario(button.dataset.benchmarkScenario)));
    $$('.architecture-node').forEach(button => button.addEventListener('click', () => renderArchitectureDetail(button.dataset.architectureNode)));
    $('rawDetails').addEventListener('toggle', () => { if ($('rawDetails').open) renderRawSnapshot(); });
    $('copySnapshotButton').addEventListener('click', () => state.data && copyText(JSON.stringify(state.data, null, 2), 'Snapshot copiado.'));
    $('pollInterval').addEventListener('change', () => {
      state.pollMs = boundedNumber($('pollInterval').value, 3000, 2000, 10000);
      safeStorage.set(STORAGE.poll, String(state.pollMs));
      schedule();
      renderSettings();
    });
    $('feedLimit').addEventListener('change', () => {
      state.feedLimit = boundedNumber($('feedLimit').value, 60, 30, 80);
      safeStorage.set(STORAGE.feedLimit, String(state.feedLimit));
      renderFeed();
      renderSettings();
    });
    $('saveApiBase').addEventListener('click', () => {
      let raw;
      try {
        raw = normalizeApiBase($('apiBaseInput').value);
      } catch (error) {
        toast(error?.message || 'Origem inválida.');
        return;
      }
      safeStorage.set(STORAGE.apiBase, raw);
      clearRemoteSnapshot();
      toast('Origem atualizada.');
      refresh({ manual: true });
    });
    $('clearApiBase').addEventListener('click', () => {
      safeStorage.remove(STORAGE.apiBase);
      $('apiBaseInput').value = '';
      clearRemoteSnapshot();
      toast('Monitorando a origem atual.');
      refresh({ manual: true });
    });
    $('resetPreferences').addEventListener('click', () => {
      Object.values(STORAGE).forEach(key => safeStorage.remove(key));
      state.pollMs = 3000;
      state.feedLimit = 60;
      state.paused = false;
      setPauseState();
      applyTheme('system');
      setView('live');
      renderSettings();
      toast('Preferências restauradas.');
      refresh({ manual: true });
    });
    window.addEventListener('hashchange', () => setView(location.hash.slice(1), { updateHash: false }));
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && state.menuOpen) closeMenu();
      else trapMenuFocus(event);
    });
    window.addEventListener('resize', () => { if (state.view === 'health') requestAnimationFrame(drawTrafficChart); });
    window.addEventListener('online', () => refresh({ manual: true }));
    window.addEventListener('offline', () => setConnection('offline', 'Sem rede'));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !state.paused) refresh({ manual: true }); });
    matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (themeMode() === 'system') applyTheme('system'); });
  }

  function init() {
    applyTheme(themeMode());
    bindEvents();
    setPauseState();
    $('appDrawer').inert = true;
    $('pollInterval').value = String(state.pollMs);
    $('feedLimit').value = String(state.feedLimit);
    const initial = VIEW_ALIASES[location.hash.slice(1)] || location.hash.slice(1) || safeStorage.get(STORAGE.view, 'live');
    setView(initial, { updateHash: false });
    renderSettings();
    loadBenchmarkData();
    refresh({ manual: true });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }

  init();
})();
