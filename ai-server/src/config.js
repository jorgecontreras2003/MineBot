import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Lee una variable de entorno obligatoria.
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable de entorno obligatoria no definida: ${name}`);
  }
  return value;
}

/**
 * Lee una variable numérica con valor por defecto.
 * @param {string} name
 * @param {number} defaultValue
 * @returns {number}
 */
function parseNumber(name, defaultValue) {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Configuración central del AI Server.
 */
export const config = {
  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
  },

  bot: {
    name: process.env.BOT_NAME || 'SteveAI',
    trigger: process.env.BOT_TRIGGER || '@bot',
    personality: process.env.BOT_PERSONALITY || 'troll',
  },

  server: {
    // Render (y otros hosts) suelen exponer el puerto en PORT.
    port: parseNumber('PORT', parseNumber('HTTP_PORT', 3000)),
  },

  apiKey: process.env.API_KEY || undefined,

  memory: {
    size: parseNumber('MEMORY_SIZE', 10),
  },

  cooldown: {
    seconds: parseNumber('COOLDOWN_SECONDS', 5),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
