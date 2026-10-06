// Express 4 does not catch rejected promises; pass them to the error handler.
export const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
