const rateLimitStore = new Map();

function createRateLimiter(options) {
  const { windowMs, max, key = (req) => req.ip } = options;

  return (req, res, next) => {
    const identifier = key(req);
    const now = Date.now();

    if (!rateLimitStore.has(identifier)) {
      rateLimitStore.set(identifier, []);
    }

    const requests = rateLimitStore.get(identifier);
    const validRequests = requests.filter((time) => now - time < windowMs);
    validRequests.push(now);
    rateLimitStore.set(identifier, validRequests);

    if (validRequests.length > max) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    next();
  };
}

function paymentRateLimiter(req, res, next) {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    key: (req) => {
      if (req.user && req.user.id) return `user:${req.user.id}`;
      return req.ip;
    },
  });
  return limiter(req, res, next);
}

function paymentInitRateLimiter(req, res, next) {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    key: (req) => {
      if (req.user && req.user.id) return `user:${req.user.id}`;
      return req.ip;
    },
  });
  return limiter(req, res, next);
}

module.exports = { createRateLimiter, paymentRateLimiter, paymentInitRateLimiter };
