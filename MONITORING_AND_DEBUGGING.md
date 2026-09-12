# AVERON monitoring & debugging

This build adds production-oriented observability without exposing secrets to the browser.

## Implemented

1. **Request IDs** — every HTTP request gets `X-Request-ID`; a valid inbound ID is propagated.
2. **Error context** — complete stack traces are written to structured server logs. They are intentionally **not** returned to clients.
3. **Structured JSON logs** — server `console.log/warn/error` calls are converted to JSON records, with request context when available.
4. **Health checks** — `GET /healthz` and `GET /readyz` report DB, Stripe/CJ configuration state, admin auth, secure-cookie state, uptime and safe process memory information.
5. **Database monitoring** — SQLite `prepare/run/get/all/exec` operations are timed and logged by query fingerprint. Parameter values are not logged to avoid leaking customer data.
6. **Cache tracking** — the CJ access-token memory cache records hit/miss metrics. There is no general application cache yet, so there is nothing else to track.
7. **Performance metrics** — request latency, 2xx/3xx/4xx/5xx counts, CPU time, memory, event-loop delay, DB timings and cache counters are available at the authenticated `GET /api/admin/ops/metrics` endpoint.
8. **Regression tests** — `npm test` checks health, request-ID propagation, admin-route protection, static-secret blocking and invalid-login behavior.
9. **Configurable anomaly alerts** — slow requests, slow DB operations and HTTP 5xx responses generate structured `anomaly_alert` logs. Set `ALERT_WEBHOOK_URL` to forward anomaly JSON to an HTTPS monitoring endpoint.

## Deliberately not claimed as fully implemented

10. **Automatic deployment rollback** is deployment-platform functionality, not HTML/Express functionality. This package includes `npm run deploy:verify -- https://your-domain/readyz`, which exits non-zero when the new release is unhealthy. Your HostGator deployment process (or a CI/CD provider) must be configured to use that exit status to restore the previous release. Do not claim automatic rollback until that hosting-side step exists and has been tested.

## Security note

Detailed stack traces, SQL parameter values, secrets, cookies, access tokens and API keys are never sent to public health responses. Stack traces remain server-side in JSON logs.
