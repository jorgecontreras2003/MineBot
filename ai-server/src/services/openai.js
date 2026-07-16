import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { buildTools, ToolExecutor } from './tools.js';

/**
 * Prompts de sistema disponibles por personalidad.
 */
const PERSONALITIES = {
  troll: `Eres un jugador veterano de Minecraft en un servidor Fabric, 100% chileno.
Hablas con modismos chilenos marcados: po, caleta, bacán, fome, choclo, al tiro, aweonao, cuático, cagado, flaite/pituco según el mood, y ligas tus frases con "weón", "hermanito" o "cumpa".
Tu personalidad es troll, descarada y sin filtros: te encanta molestar, tirar pullas, insultar con gracia en chileno y responder con sarcasmo.
No tienes pudor para hablar de ningún tema que te pregunten.
Responde siempre en español chileno salvo que te escriban en otro idioma.
BREVE: máximo 3 líneas cortas. Usa tu razonamiento para compactar la respuesta y no pasarte.
Máximo 50 palabras. No hagas listas, no expliques, no te extiendas.
Responde directo al grano, como mensaje de chat.
Si tienes acceso a comandos del servidor, úsalos para responder con datos reales cuando te pregunten por ubicaciones, estructuras, biomas o información del servidor.
NO cites fuentes, NO añadas referencias como [^1^] ni digas "según X". Responde directo sin mencionar de dónde sacaste la info.
Si no sabes algo, admítelo con una burla chilena corta en lugar de inventar datos.`,

  friendly: `Eres un jugador veterano de Minecraft en un servidor Fabric.
Hablas de forma amigable, natural y útil.
Responde siempre en español salvo que te escriban en otro idioma.
BREVE: máximo 3 líneas cortas. Usa tu razonamiento para compactar la respuesta y no pasarte.
Máximo 50 palabras. No hagas listas, no expliques, no te extiendas.
Responde directo al grano, como mensaje de chat.
Si tienes acceso a comandos del servidor, úsalos para responder con datos reales cuando te pregunten por ubicaciones, estructuras, biomas o información del servidor.
NO cites fuentes, NO añadas referencias como [^1^] ni digas "según X". Responde directo sin mencionar de dónde sacaste la info.
Si no sabes algo, admítelo con humor. No inventes datos.`,
};

/**
 * Cliente para comunicarse con la API de OpenAI.
 * Utiliza la Responses API, necesaria para GPT-5.
 */
export class OpenAIClient {
  constructor() {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
    this.model = config.openai.model;
  }

  /**
   * Genera una respuesta con GPT usando el contexto del servidor.
   * Soporta function calling para herramientas como RCON.
   *
   * @param {object} params
   * @param {string} params.player
   * @param {string} params.message
   * @param {Array<{role: 'user'|'assistant', content: string}>} params.history
   * @param {object} params.context
   * @returns {Promise<{content: string, tokens: number, durationMs: number}>}
   */
  async generateResponse({ player, message, history, context }) {
    const startTime = Date.now();
    const toolExecutor = new ToolExecutor();

    const instructions = buildInstructions(context);
    const input = buildInput({ player, message, history });
    const tools = buildTools();

    let response = await this._createResponse({
      instructions,
      input,
      tools,
    });

    let rounds = 0;
    const maxRounds = 3;
    while (hasFunctionCalls(response) && rounds < maxRounds) {
      rounds++;
      const calls = extractFunctionCalls(response);
      logger.info('OpenAI solicitó herramientas', { tools: calls.map((c) => c.name) });

      for (const call of calls) {
        const result = await toolExecutor.execute(call.name, call.arguments);
        input.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: String(result),
        });
      }

      response = await this._createResponse({
        instructions,
        input,
        tools,
      });
    }

    toolExecutor.close();

    const content = extractOutputText(response);
    const tokens = response.usage?.total_tokens ?? 0;
    const durationMs = Date.now() - startTime;

    logger.info('Respuesta generada por OpenAI', { player, tokens, durationMs, contentLength: content.length });

    return { content, tokens, durationMs };
  }

  _createResponse({ instructions, input, tools }) {
    const request = {
      model: this.model,
      instructions,
      input,
      max_output_tokens: config.openai.maxOutputTokens,
    };

    if (tools && tools.length > 0) {
      request.tools = tools;
    }

    if (config.openai.reasoning) {
      request.reasoning = { effort: 'low' };
    }

    return this.client.responses.create(request);
  }
}

/**
 * Construye el prompt de instrucciones combinando personalidad y contexto del servidor.
 * @param {object} context
 * @returns {string}
 */
function buildInstructions(context) {
  return `${buildSystemPrompt()}\n\n${buildContextPrompt(context)}`;
}

/**
 * Construye el input combinando historial y pregunta actual.
 * @param {object} params
 * @returns {Array<object>}
 */
function buildInput({ player, message, history }) {
  const items = [
    ...history.map((entry) => ({
      type: 'message',
      role: entry.role,
      content: entry.content,
    })),
    {
      type: 'message',
      role: 'user',
      content: `${player} pregunta: "${message}"`,
    },
  ];

  return items;
}

/**
 * Prompt de sistema con la personalidad del bot.
 * @returns {string}
 */
function buildSystemPrompt() {
  const key = config.bot.personality;
  return PERSONALITIES[key] || PERSONALITIES.troll;
}

/**
 * Verifica si la respuesta contiene llamadas a funciones.
 * @param {object} response
 * @returns {boolean}
 */
function hasFunctionCalls(response) {
  if (!response.output || !Array.isArray(response.output)) return false;
  return response.output.some((item) => item.type === 'function_call');
}

/**
 * Extrae las llamadas a funciones de la respuesta.
 * @param {object} response
 * @returns {Array<{call_id: string, name: string, arguments: object}>}
 */
function extractFunctionCalls(response) {
  return response.output
    .filter((item) => item.type === 'function_call')
    .map((item) => {
      let args = {};
      try {
        args = JSON.parse(item.arguments || '{}');
      } catch {
        args = {};
      }
      return {
        call_id: item.call_id,
        name: item.name,
        arguments: args,
      };
    });
}

/**
 * Extrae el texto de salida de la Responses API, con fallback robusto.
 * @param {object} response
 * @returns {string}
 */
function extractOutputText(response) {
  const text = response.output_text?.trim();
  if (text) return text;

  const items = response.output || [];
  const messageText = items
    .filter((item) => item.type === 'message' && item.role === 'assistant')
    .map((item) => {
      if (typeof item.content === 'string') return item.content;
      return item.content?.map((c) => c.text || c.output_text || '').join(' ');
    })
    .join(' ')
    .trim();

  if (messageText) return messageText;

  logger.warn('OpenAI devolvió respuesta vacía, usando fallback', { response });
  return config.bot.personality === 'troll'
    ? 'Me quedé en blanco, weón. Repite la wea.'
    : 'Me quedé en blanco. ¿Puedes repetir? :c';
}

/**
 * Construye el contexto del servidor como texto plano.
 * @param {object} context
 * @returns {string}
 */
function buildContextPrompt(context) {
  const players = context.players?.length
    ? context.players
        .map(
          (p) =>
            `- ${p.name}: ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`
        )
        .join('\n')
    : 'Sin jugadores';

  const mods = context.mods?.length ? context.mods.join(', ') : 'No disponibles';

  const playerCount = context.server?.online_count ?? context.players?.length ?? '?';
  const maxPlayers = context.server?.max_players ?? '?';

  return `Contexto actual del servidor:
- Jugador que pregunta: ${context.player}
- Hora: ${context.server?.time ?? 'desconocida'}
- Clima: ${context.server?.weather ?? 'desconocido'}
- Dimensión: ${context.server?.dimension ?? 'desconocida'}
- Bioma: ${context.server?.biome ?? 'desconocido'}
- Jugadores conectados: ${playerCount}/${maxPlayers}
- Lista de jugadores:\n${players}
- Mods cargados: ${mods}
- Estado del bot: vida ${context.bot?.health ?? '?'}, hambre ${context.bot?.food ?? '?'}`;
}
