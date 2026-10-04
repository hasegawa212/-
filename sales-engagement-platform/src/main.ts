import { loadConfig } from './infrastructure/config.js';
import { createLogger } from './infrastructure/logging/logger.js';
import { buildApp } from './interface/http/app.js';

const config = loadConfig(process.env);
const app = buildApp({ config });

const shutdown = (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  app.close().then(
    () => process.exit(0),
    () => process.exit(1),
  );
};
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  createLogger('error').fatal({ err }, 'failed to start');
  process.exit(1);
}
