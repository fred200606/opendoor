/** First message of a Laravel error array (or a plain string). */
export function errorText(error) {
  if (!error) return null;
  return Array.isArray(error) ? error[0] : error;
}
