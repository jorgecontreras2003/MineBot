import express from 'express';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { ChatEngine } from './services/chatEngine.js';

/**
 * Crea y configura la aplicación Express.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();
  const engine = new ChatEngine();

  app.use(express.json({ limit: '1mb' }));

  // Health check público para Railway.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', bot: config.bot.name });
  });

  // Middleware de autenticación para el endpoint /chat.
  app.use('/chat', (req, res, next) => {
    if (!config.apiKey) {
      return next();
    }

    const providedKey = req.headers['x-api-key'];
    if (providedKey !== config.apiKey) {
      logger.warn('Intento de acceso no autorizado', {
        ip: req.ip,
        key: providedKey ? 'provided' : 'missing',
      });
      return res.status(401).json({ error: 'No autorizado' });
    }

    next();
  });

  app.post('/chat', async (req, res) => {
    const startTime = Date.now();
    const { player, message, server, bot, players, mods } = req.body;

    if (!player || !message) {
      logger.warn('Solicitud inválida', { body: req.body });
      return res.status(400).json({ error: 'Faltan player o message' });
    }

    logger.info('Consulta recibida', { player, message });

    try {
      const result = await engine.process({
        player,
        message,
        server: server || {},
        bot: bot || {},
        players: players || [],
        mods: mods || [],
      });

      const durationMs = Date.now() - startTime;
      logger.info('Respuesta enviada', {
        player,
        source: result.source,
        durationMs,
        tokens: result.tokens,
      });

      return res.json({ reply: result.reply });
    } catch (error) {
      logger.error('Error procesando consulta', {
        player,
        message,
        error: error.message,
      });
      return res.status(500).json({
        reply: 'Ups, algo salió mal. Intenta de nuevo en un momento.',
      });
    }
  });

  // Middleware global de errores.
  app.use((err, _req, res, _next) => {
    logger.error('Error en Express', { error: err.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
