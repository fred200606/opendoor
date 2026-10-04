import { createApp } from './app.js';
import { loadConfig } from './config.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

createApp(config).listen(config.port, () => {
  console.log(`OpenDoor gateway listening on http://localhost:${config.port} (core: ${config.coreUrl}, insights: ${config.insightsUrl})`);
});
