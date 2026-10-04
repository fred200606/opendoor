// OpenDoor error envelope (same shape as Core): { error: { code, message, request_id } }

export const ERRORS = {
  NOT_FOUND: [404, 'The requested resource was not found.'],
  RATE_LIMITED: [429, 'Too many requests. Please try again later.'],
  UPSTREAM_ERROR: [502, 'The service returned an invalid response. Please try again.'],
  SERVICE_UNAVAILABLE: [503, 'The service is temporarily unavailable. Please try again shortly.'],
  UPSTREAM_TIMEOUT: [504, 'The service took too long to respond. Please try again.'],
  SERVER_ERROR: [500, 'Something went wrong. Please try again later.'],
};

export function sendError(req, res, code) {
  const [status, message] = ERRORS[code];

  res.status(status).json({
    error: { code, message, request_id: req.id },
  });
}
