'use strict';
const crypto = require('crypto');

function requestIdMiddleware(req, res, next) {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  const requestId = incoming || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    req._requestLog = { requestId, method: req.method, route: req.originalUrl, status: res.statusCode, durationMs: Math.round(durationMs * 100) / 100 };
  });
  next();
}

module.exports = { requestIdMiddleware };
