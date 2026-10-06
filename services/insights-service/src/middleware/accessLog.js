// One JSON line per request. Deliberately logs no headers (Authorization, X-Service-Key)
// and no bodies (accommodation needs and feedback are personal data).
export function accessLog(req, res, next) {
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(
      JSON.stringify({
        time: new Date().toISOString(),
        request_id: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Math.round(durationMs),
      }),
    );
  });

  next();
}
