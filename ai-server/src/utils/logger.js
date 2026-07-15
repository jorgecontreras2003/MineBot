import { config } from '../config.js';

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL = LEVELS[config.logging.level] ?? LEVELS.info;

/**
 * Logger simple con niveles y metadatos.
 */
export const logger = {
  debug: (message, meta) => log('debug', message, meta),
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};

function log(level, message, meta = {}) {
  if (LEVELS[level] < CURRENT_LEVEL) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';

  console[level === 'error' ? 'error' : 'log'](`${prefix} ${message}${metaText}`);
}
