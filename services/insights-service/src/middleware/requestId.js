import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reuse a valid incoming X-Request-ID or create one; forwarded upstream and echoed to the client.
export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  const id = incoming && UUID.test(incoming) ? incoming : randomUUID();

  req.id = id;
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}
