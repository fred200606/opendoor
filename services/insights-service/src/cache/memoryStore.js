// In-memory cache with the same interface as the MySQL store; used by tests and when no
// CACHE_DB_USER is configured.
export function createMemoryStore() {
  const tables = new Map();
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };

  return {
    async migrate() {},
    async ping() {},
    async get(name, key) {
      const entry = table(name).get(key);
      return entry ? structuredClone(entry) : null;
    },
    async put(name, key, payload, fetchedAt = new Date()) {
      table(name).set(key, structuredClone({ payload, fetchedAt }));
    },
    async close() {},
  };
}
