import { config } from './config.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';

/**
 * Punto de entrada del AI Server.
 */
function main() {
  const app = createApp();

  app.listen(config.server.port, () => {
    logger.info('AI Server iniciado', {
      port: config.server.port,
      bot: config.bot.name,
      model: config.openai.model,
    });
  });
}

main();
