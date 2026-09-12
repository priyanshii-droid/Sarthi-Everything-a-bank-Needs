const crypto = require('crypto');

function createSessionId() {
  return crypto.randomBytes(24).toString('hex');
}

function sanitizeSessionId(value) {
  const id = String(value || '').trim();
  return /^[a-f0-9]{16,64}$/i.test(id) ? id : null;
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
}

function createRateLimiter({ windowMs = 60_000, max = 120, key = req => req.ip || 'unknown' } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    let bucket = buckets.get(k);
    if (!bucket || now - bucket.startedAt >= windowMs) bucket = { startedAt: now, count: 0 };
    bucket.count += 1;
    buckets.set(k, bucket);
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - bucket.startedAt)) / 1000)));
      return res.status(429).json({ ok:false, error:{ code:'RATE_LIMITED', message:'Too many requests. Please try again shortly.', requestId:req.requestId } });
    }
    next();
  };
}

module.exports = { createSessionId, sanitizeSessionId, securityHeaders, createRateLimiter };
