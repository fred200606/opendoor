import axios from 'axios';

// Core Service internal API (private network only). Posting data is never cached here: the
// posting, its accommodations and the trust score can change at any time.

export function createCoreClient({ baseUrl, serviceKey, timeoutMs }) {
  const http = axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    headers: { Accept: 'application/json', 'X-Service-Key': serviceKey ?? '' },
  });

  return {
    /**
     * GET /internal/job-postings/{id}/summary → the summary, or null when Core says 404
     * (posting missing or not visible). Any other failure rejects.
     */
    async postingSummary(id, requestId) {
      try {
        const { data } = await http.get(`/internal/job-postings/${id}/summary`, {
          headers: requestId ? { 'X-Request-ID': requestId } : {},
        });
        if (!data || data.id !== id || !Array.isArray(data.accommodations)) {
          throw new Error('Core returned an unexpected posting summary');
        }
        return data;
      } catch (err) {
        if (err.response?.status === 404) return null;
        throw err;
      }
    },
  };
}
