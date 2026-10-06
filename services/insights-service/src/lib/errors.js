// OpenDoor error envelope (same shape as Core and the gateway): { error: { code, message, request_id } }

export const ERRORS = {
  NOT_FOUND: [404, 'The requested resource was not found.'],
  VALIDATION_FAILED: [422, 'The given data was invalid.'],
  SERVICE_UNAVAILABLE: [503, 'The service is temporarily unavailable. Please try again shortly.'],
  SERVER_ERROR: [500, 'Something went wrong. Please try again later.'],
};

/** Thrown by route handlers; the app's error handler turns it into the envelope. */
export class ApiError extends Error {
  constructor(code, { errors } = {}) {
    super(code);
    this.code = code;
    this.errors = errors;
  }
}

export function sendError(req, res, code, { errors } = {}) {
  const [status, message] = ERRORS[code];

  // 422 keeps Laravel's format next to the envelope, like Core.
  if (errors) {
    res.status(status).json({ message, error: { code, request_id: req.id }, errors });
    return;
  }

  res.status(status).json({
    error: { code, message, request_id: req.id },
  });
}
