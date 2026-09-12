'use strict';

const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const { monitorEventLoopDelay, performance } = require('perf_hooks');

const contextStore = new AsyncLocalStorage();
const startedAt = Date.now();
const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();

const requestMetrics = {
  total: 0,
  active: 0,
  status2xx: 0,
  status3xx: 0,
  status4xx: 0,
  status5xx: 0,
  totalDurationMs: 0,
  maxDurationMs: 0,
  recentDurationsMs: [],
  byRoute: new Map()
};

const dbMetrics = { queries: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0 };
const cacheMetrics = new Map();
const alertState = new Map();

function safeRequestId(value) {
  const v = String(value || '').trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(v) ? v : '';
}

function currentContext() {
  return contextStore.getStore() || {};
}

function serializeError(err) {
  if (!(err instanceof Error)) return { message: String(err) };
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    code: err.code ?? err.cjCode ?? undefined,
    cause: err.cause instanceof Error ? serializeError(err.cause) : err.cause
  };
}

function sanitizeValue(value, depth = 0) {
  if (depth > 4) return '[depth-limit]';
  if (value instanceof Error) return serializeError(value);
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return value.length > 2000 ? value.slice(0, 2000) + '…' : value;
  if (Array.isArray(value)) return value.slice(0, 50).map(v => sanitizeValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 100)) {
      if (/password|secret|token|authorization|cookie|api[_-]?key/i.test(k)) out[k] = '[REDACTED]';
      else out[k] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

function log(level, event, fields = {}) {
  const ctx = currentContext();
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event: String(event || 'log'),
    service: 'averon',
    request_id: ctx.requestId || undefined,
    method: ctx.method || undefined,
    path: ctx.path || undefined,
    ...sanitizeValue(fields)
  };
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function installStructuredConsole() {
  const make = level => (...args) => {
    const errors = args.filter(v => v instanceof Error);
    log(level, 'legacy_console', {
      message: args.filter(v => !(v instanceof Error)).map(v => typeof v === 'string' ? v : sanitizeValue(v)).join(' '),
      errors: errors.length ? errors.map(serializeError) : undefined
    });
  };
  console.log = make('info');
  console.info = make('info');
  console.warn = make('warn');
  console.error = make('error');
}

function normalizedPath(req) {
  const raw = String(req.path || req.url || '/').split('?')[0];
  return raw
    .replace(/cs_(?:test|live)_[A-Za-z0-9_-]+/g, ':checkout_session')
    .replace(/SD\d{10,}/gi, ':cj_order')
    .replace(/[A-Fa-f0-9]{24,}/g, ':id');
}

function requestContextMiddleware(req, res, next) {
  const requestId = safeRequestId(req.get('x-request-id')) || crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);
  const start = performance.now();
  const cpuStart = process.cpuUsage();
  requestMetrics.total += 1;
  requestMetrics.active += 1;
  const routeKey = `${req.method} ${normalizedPath(req)}`;

  contextStore.run({ requestId, method: req.method, path: normalizedPath(req) }, () => {
    log('info', 'request_started', { remote_ip: req.ip });
    res.on('finish', () => {
      const durationMs = performance.now() - start;
      const cpu = process.cpuUsage(cpuStart);
      requestMetrics.active = Math.max(0, requestMetrics.active - 1);
      requestMetrics.totalDurationMs += durationMs;
      requestMetrics.maxDurationMs = Math.max(requestMetrics.maxDurationMs, durationMs);
      requestMetrics.recentDurationsMs.push(durationMs);
      if (requestMetrics.recentDurationsMs.length > 500) requestMetrics.recentDurationsMs.shift();
      const bucket = Math.floor(res.statusCode / 100);
      if (bucket === 2) requestMetrics.status2xx += 1;
      else if (bucket === 3) requestMetrics.status3xx += 1;
      else if (bucket === 4) requestMetrics.status4xx += 1;
      else if (bucket === 5) requestMetrics.status5xx += 1;
      const route = requestMetrics.byRoute.get(routeKey) || { count: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0 };
      route.count += 1;
      route.errors += res.statusCode >= 500 ? 1 : 0;
      route.totalDurationMs += durationMs;
      route.maxDurationMs = Math.max(route.maxDurationMs, durationMs);
      requestMetrics.byRoute.set(routeKey, route);
      log(res.statusCode >= 500 ? 'error' : 'info', 'request_finished', {
        status_code: res.statusCode,
        duration_ms: Number(durationMs.toFixed(2)),
        cpu_user_ms: Number((cpu.user / 1000).toFixed(2)),
        cpu_system_ms: Number((cpu.system / 1000).toFixed(2)),
        response_bytes: Number(res.getHeader('content-length') || 0) || undefined
      });
      const slowMs = Number(process.env.ALERT_SLOW_REQUEST_MS || 2500);
      if (durationMs >= slowMs) emitAnomaly('slow_request', { route: routeKey, duration_ms: Number(durationMs.toFixed(2)), threshold_ms: slowMs });
      if (res.statusCode >= 500) emitAnomaly('http_5xx', { route: routeKey, status_code: res.statusCode });
    });
    next();
  });
}

function timedDbPrepare(db, sql) {
  const statement = db.prepare(sql);
  const fingerprint = crypto.createHash('sha256').update(String(sql).replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);
  const operation = String(sql).trim().split(/\s+/)[0]?.toUpperCase() || 'SQL';
  const wrap = method => {
    if (typeof statement[method] !== 'function') return;
    const original = statement[method].bind(statement);
    statement[method] = (...args) => {
      const start = performance.now();
      try {
        const result = original(...args);
        const ms = performance.now() - start;
        dbMetrics.queries += 1;
        dbMetrics.totalDurationMs += ms;
        dbMetrics.maxDurationMs = Math.max(dbMetrics.maxDurationMs, ms);
        log('info', 'db_query', { operation, query_id: fingerprint, duration_ms: Number(ms.toFixed(3)), parameter_count: args.length });
        const threshold = Number(process.env.ALERT_SLOW_DB_MS || 250);
        if (ms >= threshold) emitAnomaly('slow_db_query', { operation, query_id: fingerprint, duration_ms: Number(ms.toFixed(3)), threshold_ms: threshold });
        return result;
      } catch (err) {
        const ms = performance.now() - start;
        dbMetrics.queries += 1;
        dbMetrics.errors += 1;
        dbMetrics.totalDurationMs += ms;
        dbMetrics.maxDurationMs = Math.max(dbMetrics.maxDurationMs, ms);
        log('error', 'db_query_failed', { operation, query_id: fingerprint, duration_ms: Number(ms.toFixed(3)), error: serializeError(err) });
        throw err;
      }
    };
  };
  for (const method of ['run', 'get', 'all']) wrap(method);
  return statement;
}

function timedDbExec(db, sql) {
  const start = performance.now();
  const fingerprint = crypto.createHash('sha256').update(String(sql).replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);
  try {
    const result = db.exec(sql);
    const ms = performance.now() - start;
    dbMetrics.queries += 1;
    dbMetrics.totalDurationMs += ms;
    dbMetrics.maxDurationMs = Math.max(dbMetrics.maxDurationMs, ms);
    log('info', 'db_exec', { query_id: fingerprint, duration_ms: Number(ms.toFixed(3)) });
    return result;
  } catch (err) {
    dbMetrics.queries += 1;
    dbMetrics.errors += 1;
    log('error', 'db_exec_failed', { query_id: fingerprint, error: serializeError(err) });
    throw err;
  }
}

function trackCache(name, result) {
  const key = String(name || 'cache');
  const row = cacheMetrics.get(key) || { hits: 0, misses: 0 };
  if (result === 'hit') row.hits += 1;
  else row.misses += 1;
  cacheMetrics.set(key, row);
  log('info', 'cache_access', { cache: key, result });
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function metricsSnapshot() {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const routes = {};
  for (const [key, value] of requestMetrics.byRoute.entries()) {
    routes[key] = {
      ...value,
      avgDurationMs: value.count ? Number((value.totalDurationMs / value.count).toFixed(2)) : 0,
      maxDurationMs: Number(value.maxDurationMs.toFixed(2))
    };
  }
  const caches = Object.fromEntries(cacheMetrics.entries());
  return {
    service: 'averon',
    uptime_seconds: Math.floor(process.uptime()),
    requests: {
      ...requestMetrics,
      byRoute: routes,
      recentDurationsMs: undefined,
      avgDurationMs: requestMetrics.total ? Number((requestMetrics.totalDurationMs / requestMetrics.total).toFixed(2)) : 0,
      p95DurationMs: Number(percentile(requestMetrics.recentDurationsMs, 0.95).toFixed(2))
    },
    database: {
      ...dbMetrics,
      avgDurationMs: dbMetrics.queries ? Number((dbMetrics.totalDurationMs / dbMetrics.queries).toFixed(3)) : 0,
      maxDurationMs: Number(dbMetrics.maxDurationMs.toFixed(3))
    },
    cache: caches,
    memory_bytes: { rss: mem.rss, heap_total: mem.heapTotal, heap_used: mem.heapUsed, external: mem.external },
    cpu_microseconds: cpu,
    event_loop_ms: {
      min: Number((eventLoop.min / 1e6).toFixed(2)),
      mean: Number((eventLoop.mean / 1e6).toFixed(2)),
      max: Number((eventLoop.max / 1e6).toFixed(2)),
      p95: Number((eventLoop.percentile(95) / 1e6).toFixed(2))
    },
    started_at: new Date(startedAt).toISOString()
  };
}

async function emitAnomaly(kind, details = {}) {
  const cooldownMs = Math.max(5000, Number(process.env.ALERT_COOLDOWN_MS || 60000));
  const key = `${kind}:${details.route || details.query_id || 'global'}`;
  const now = Date.now();
  if ((alertState.get(key) || 0) + cooldownMs > now) return;
  alertState.set(key, now);
  const payload = { kind, ...details };
  log('warn', 'anomaly_alert', payload);
  const url = String(process.env.ALERT_WEBHOOK_URL || '').trim();
  if (!/^https:\/\//i.test(url)) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'averon', timestamp: new Date().toISOString(), ...payload }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (err) {
    log('error', 'alert_delivery_failed', { kind, error: serializeError(err) });
  }
}

function errorMiddleware(err, req, res, next) {
  log('error', 'unhandled_request_error', {
    error: serializeError(err),
    status_code: Number(err.status || err.statusCode || 500),
    context: { method: req.method, path: normalizedPath(req), content_type: req.get('content-type') || '' }
  });
  if (res.headersSent) return next(err);
  const status = Number(err.status || err.statusCode || 500);
  return res.status(status >= 400 && status <= 599 ? status : 500).json({
    error: status >= 500 ? 'Internal server error.' : String(err.message || 'Request failed.'),
    request_id: currentContext().requestId || res.getHeader('X-Request-ID') || null
  });
}

module.exports = {
  installStructuredConsole,
  requestContextMiddleware,
  timedDbPrepare,
  timedDbExec,
  trackCache,
  metricsSnapshot,
  serializeError,
  log,
  errorMiddleware,
  currentContext
};
