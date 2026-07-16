import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { MemoryManager } from '../utils/memory.js';
import { CooldownManager } from '../utils/cooldown.js';
import { OpenAIClient } from './openai.js';
import { getOpenAITools } from './toolRegistry.js';

/**
 * Motor híbrido que decide si responde localmente, llama a OpenAI o
 * utiliza el Bridge de Minecraft para obtener datos en tiempo real.
 *
 * El Bridge funciona en round-trip: el AI Server le pide al mod que ejecute una
 * herramienta, el mod ejecuta la acción y vuelve a llamar a /chat con el resultado.
 */
export class ChatEngine {
  constructor() {
    this.openai = new OpenAIClient();
    this.memory = new MemoryManager();
    this.cooldown = new CooldownManager();
  }

  /**
   * Procesa una consulta del Fabric Bridge.
   *
   * @param {object} request
   * @param {string} request.player
   * @param {string} request.message
   * @param {object} request.server
   * @param {object} request.bot
   * @param {Array<object>} request.players
   * @param {Array<string>} [request.mods]
   * @param {object} [request.bridgeResult]
   * @param {string} request.bridgeResult.callId
   * @param {string} request.bridgeResult.previousResponseId
   * @param {object} request.bridgeResult.result
   * @returns {Promise<{reply?: string, bridge?: object, source: 'local'|'openai'|'bridge', tokens?: number, durationMs?: number}>}
   */
  async process({ player, message, server, bot, players, mods, bridgeResult }) {
    const cooldown = this.cooldown.check(player);
    if (!cooldown.allowed) {
      return {
        reply: `Al tiro, weón. Espera ${cooldown.remainingSeconds}s antes de volver a hablarme.`,
        source: 'local',
      };
    }

    this.cooldown.register(player);

    const normalizedMessage = message.trim();
    const context = { player, server, bot, players, mods };

    // Si estamos en la segunda vuelta del Bridge, el LLM ya recibió el resultado
    // de la herramienta y debe generar la respuesta final.
    if (bridgeResult) {
      return this._handleBridgeResult({ player, context, bridgeResult });
    }

    const localReply = this._tryLocalResponse(normalizedMessage, context);
    if (localReply) {
      this.memory.add(player, 'assistant', localReply);
      logger.info('Respuesta local', { player, message });
      return { reply: localReply, source: 'local' };
    }

    const history = this.memory.get(player);
    this.memory.add(player, 'user', normalizedMessage);

    const tools = config.bridge.enabled ? getOpenAITools() : undefined;

    const firstResponse = await this.openai.generateResponse({
      player,
      message: normalizedMessage,
      history,
      context,
      tools,
    });

    if (firstResponse.toolCalls && firstResponse.toolCalls.length > 0) {
      const toolCall = firstResponse.toolCalls[0];
      logger.info('LLM solicitó herramienta', {
        player,
        tool: toolCall.name,
        arguments: toolCall.arguments,
      });
      return {
        bridge: {
          callId: toolCall.callId,
          tool: toolCall.name,
          arguments: toolCall.arguments,
          previousResponseId: firstResponse.response.id,
        },
        source: 'bridge',
      };
    }

    const reply = this._formatReply(firstResponse.content);
    this.memory.add(player, 'assistant', reply);
    logger.info('Respuesta IA', {
      player,
      message,
      tokens: firstResponse.tokens,
      durationMs: firstResponse.durationMs,
      source: 'openai',
    });

    return {
      reply,
      source: 'openai',
      tokens: firstResponse.tokens,
      durationMs: firstResponse.durationMs,
    };
  }

  /**
   * Genera la respuesta final tras recibir el resultado de una herramienta.
   *
   * @param {object} params
   * @returns {Promise<{reply: string, source: 'bridge', tokens: number, durationMs: number}>}
   */
  async _handleBridgeResult({ player, bridgeResult }) {
    const { callId, previousResponseId, result } = bridgeResult;

    logger.info('Procesando resultado de herramienta', {
      player,
      callId,
      tool: result,
    });

    try {
      const followUp = await this.openai.generateFollowUp({
        previousResponse: { id: previousResponseId },
        toolResults: [{ callId, result }],
      });

      const reply = this._formatReply(followUp.content);
      this.memory.add(player, 'assistant', reply);

      logger.info('Respuesta final tras Bridge', {
        player,
        tokens: followUp.tokens,
        durationMs: followUp.durationMs,
      });

      return {
        reply,
        source: 'bridge',
        tokens: followUp.tokens,
        durationMs: followUp.durationMs,
      };
    } catch (error) {
      logger.error('Error generando respuesta final tras Bridge', {
        player,
        error: error.message,
      });
      const fallback = config.bot.personality === 'troll'
        ? 'Me perdí con la wea del Bridge, weón. Intenta de nuevo.'
        : 'No pude procesar el resultado de la herramienta. ¿Intentas de nuevo?';
      this.memory.add(player, 'assistant', fallback);
      return { reply: fallback, source: 'bridge' };
    }
  }

  /**
   * Trunca la respuesta a un máximo de 3 líneas/oraciones cortas para el chat.
   * @param {string} text
   * @returns {string}
   */
  _formatReply(text) {
    const clean = text
      .replace(/\[\^?\d+\^?\]/g, '')
      .replace(/\s*\(\d+\)\s*/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();

    const sentences = clean
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0)
      .slice(0, 3)
      .map((s) => s.trim());

    const reply = sentences.join(' ');
    // Solo cortamos con "..." si es excesivamente largo para el chat de Minecraft.
    return reply.length > 280 ? `${reply.slice(0, 277).trim()}...` : reply;
  }

  /**
   * Intenta responder sin consumir tokens.
   * @param {string} message
   * @param {object} context
   * @returns {string | null}
   */
  _tryLocalResponse(message, context) {
    const lower = message.toLowerCase();

    if (this._matches(lower, ['jugadores conectados', 'quién está conectado', 'quien esta conectado', 'lista de jugadores'])) {
      const names = context.players?.map((p) => p.name).join(', ') || 'nadie';
      const count = context.players?.length || 0;
      if (count === 0) return 'No hay nadie conectado, weón. Solo tú y tu cagá de soledad.';
      return `Conectados (${count}): ${names}. No esperaba que tuvieras perritos, cumpa.`;
    }

    if (this._matches(lower, ['cuántos jugadores', 'cuantos jugadores', 'número de jugadores'])) {
      const count = context.players?.length || 0;
      return `Hay ${count} jugador(es), po. Contando a los que realmente importan, menos.`;
    }

    const whereMatch = message.match(/(?:dónde|donde)\s+(?:está|esta)\s+(\w+)/i);
    if (whereMatch) {
      const target = whereMatch[1];
      const targetPlayer = context.players?.find(
        (p) => p.name.toLowerCase() === target.toLowerCase()
      );
      if (!targetPlayer) return `${target} no está conectado, aweonao. ¿Seguro que no te lo inventaste?`;
      return `${targetPlayer.name} está en X ${Math.floor(targetPlayer.x)} Y ${Math.floor(targetPlayer.y)} Z ${Math.floor(targetPlayer.z)}. Ve a stalkearlo, mula.`;
    }

    if (this._matches(lower, ['hora', 'qué hora es', 'que hora es', 'tiempo', 'día', 'dia'])) {
      return `Son las ${context.server?.time || 'desconocidas'}, po. ¿Tienes prisa por perder?`;
    }

    if (this._matches(lower, ['clima', 'está lloviendo', 'esta lloviendo', 'weather'])) {
      return `El clima es: ${context.server?.weather || 'desconocido'}. Igual que tu suerte, cumpa.`;
    }

    if (this._matches(lower, ['dimensión', 'dimension', 'en qué dimensión', 'en que dimension'])) {
      return `Estamos en: ${context.server?.dimension || 'una dimensión desconocida'}. Espero que no sea la de tu capacidad de jugar, weón.`;
    }

    if (this._matches(lower, ['bioma', 'en qué bioma', 'en que bioma'])) {
      return `El bioma es: ${context.server?.biome || 'desconocido'}. Tan fome como tus construcciones.`;
    }

    if (this._matches(lower, ['vida', 'salud', 'health'])) {
      return `Tengo ${context.bot?.health ?? '?'} de vida, hermanito. Más de lo que tú vas a tener si sigues así.`;
    }

    if (this._matches(lower, ['hambre', 'comida', 'food'])) {
      return `Tengo ${context.bot?.food ?? '?'} de hambre. A diferencia tuya, la mía es controlable, aweonao.`;
    }

    return null;
  }

  /**
   * @param {string} message
   * @param {string[]} phrases
   * @returns {boolean}
   */
  _matches(message, phrases) {
    return phrases.some((phrase) => message.includes(phrase.toLowerCase()));
  }
}
