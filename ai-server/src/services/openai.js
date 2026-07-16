import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

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
Si no estás seguro de un dato actual o específico del juego, usa la búsqueda web disponible.
NO cites fuentes, NO añadas referencias como [^1^] ni digas "según X". Responde directo sin mencionar de dónde sacaste la info.
Si no sabes algo, admítelo con una burla chilena corta en lugar de inventar datos.

Tienes acceso a herramientas del servidor de Minecraft. Cuando una pregunta requiera datos en tiempo real del mundo (jugadores, clima, hora, biomas, estructuras, ubicaciones, etc.), usa la herramienta correspondiente en lugar de inventar la respuesta.`,

  friendly: `Eres un jugador veterano de Minecraft en un servidor Fabric.
Hablas de forma amigable, natural y útil.
Responde siempre en español salvo que te escriban en otro idioma.
BREVE: máximo 3 líneas cortas. Usa tu razonamiento para compactar la respuesta y no pasarte.
Máximo 50 palabras. No hagas listas, no expliques, no te extiendas.
Responde directo al grano, como mensaje de chat.
Si no estás seguro de un dato actual o específico del juego, usa la búsqueda web disponible.
NO cites fuentes, NO añadas referencias como [^1^] ni digas "según X". Responde directo sin mencionar de dónde sacaste la info.
Si no sabes algo, admítelo con humor. No inventes datos.

Tienes acceso a herramientas del servidor de Minecraft. Cuando una pregunta requiera datos en tiempo real del mundo (jugadores, clima, hora, biomas, estructuras, ubicaciones, etc.), usa la herramienta correspondiente en lugar de inventar la respuesta.`,
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
   *
   * @param {object} params
   * @param {string} params.player
   * @param {string} params.message
   * @param {Array<{role: 'user'|'assistant', content: string}>} params.history
   * @param {object} params.context
   * @param {Array<object>} [params.tools]
   * @returns {Promise<{content?: string, toolCalls?: Array<object>, response: object, tokens: number, durationMs: number}>}
   */
  async generateResponse({ player, message, history, context, tools }) {
    const startTime = Date.now();

    const input = buildInput({ player, message, history, context });

    const request = {
      model: this.model,
      input,
      instructions: buildSystemPrompt(),
      max_output_tokens: config.openai.maxOutputTokens,
      tools: buildTools(tools),
    };

    if (config.openai.reasoning) {
      request.reasoning = { effort: 'low' };
    }

    const response = await this.client.responses.create(request);

    const toolCalls = extractToolCalls(response);
    const tokens = response.usage?.total_tokens ?? 0;
    const durationMs = Date.now() - startTime;

    logger.info('Respuesta generada por OpenAI', {
      player,
      tokens,
      durationMs,
      toolCalls: toolCalls.length,
      contentLength: extractOutputText(response).length,
    });

    if (toolCalls.length > 0) {
      return { toolCalls, response, tokens, durationMs };
    }

    return { content: extractOutputText(response), response, tokens, durationMs };
  }

  /**
   * Continúa una conversación previa inyectando los resultados de herramientas.
   *
   * @param {object} params
   * @param {object} params.previousResponse respuesta previa de OpenAI
   * @param {Array<{callId: string, result: object}>} params.toolResults
   * @returns {Promise<{content: string, tokens: number, durationMs: number}>}
   */
  async generateFollowUp({ previousResponse, toolResults }) {
    const startTime = Date.now();

    const input = toolResults.map((tr) => ({
      type: 'function_call_output',
      call_id: tr.callId,
      output: JSON.stringify(tr.result),
    }));

    const response = await this.client.responses.create({
      model: this.model,
      previous_response_id: previousResponse.id,
      input,
      max_output_tokens: config.openai.maxOutputTokens,
    });

    const content = extractOutputText(response);
    const tokens = response.usage?.total_tokens ?? 0;
    const durationMs = Date.now() - startTime;

    logger.info('Respuesta final generada por OpenAI tras herramientas', {
      tokens,
      durationMs,
      contentLength: content.length,
    });

    return { content, tokens, durationMs };
  }
}

/**
 * Extrae el texto de salida de la Responses API, con fallback robusto.
 * @param {object} response
 * @returns {string}
 */
function extractOutputText(response) {
  const text = response.output_text?.trim();
  if (text) return text;

  // Si la API no devolvió output_text, intentamos extraer de los mensajes.
  const items = response.output || [];
  const messageText = items
    .filter((item) => item.type === 'message' && item.role === 'assistant')
    .map((item) => item.content?.map((c) => c.text || c.output_text || '').join(' '))
    .join(' ')
    .trim();

  if (messageText) return messageText;

  logger.warn('OpenAI devolvió respuesta vacía, usando fallback', { response });
  return config.bot.personality === 'troll'
    ? 'Me quedé en blanco, weón. Repite la wea.'
    : 'Me quedé en blanco. ¿Puedes repetir? :c';
}

/**
 * Extrae las llamadas a funciones de la respuesta de OpenAI.
 * @param {object} response
 * @returns {Array<{callId: string, name: string, arguments: object}>}
 */
function extractToolCalls(response) {
  const items = response.output || [];
  return items
    .filter((item) => item.type === 'function_call')
    .map((item) => {
      let args = {};
      try {
        args = item.arguments ? JSON.parse(item.arguments) : {};
      } catch {
        logger.warn('No se pudieron parsear los argumentos del function_call', { item });
      }
      return {
        callId: item.call_id,
        name: item.name,
        arguments: args,
      };
    });
}

/**
 * Combina herramientas propias con la búsqueda web si está activada.
 * @param {Array<object>} tools
 * @returns {Array<object>}
 */
function buildTools(tools) {
  const result = [];
  if (config.openai.webSearch) {
    result.push({ type: 'web_search' });
  }
  if (tools?.length) {
    result.push(...tools);
  }
  return result.length > 0 ? result : undefined;
}

/**
 * Construye el input combinando historial, contexto y pregunta actual.
 * @param {object} params
 * @returns {Array<object>}
 */
function buildInput({ player, message, history, context }) {
  const messages = [
    { role: 'system', content: buildContextPrompt(context) },
    ...history.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: 'user', content: `${player} pregunta: "${message}"` },
  ];

  return messages;
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

  return `Contexto actual del servidor:
- Jugador que pregunta: ${context.player}
- Hora: ${context.server?.time ?? 'desconocida'}
- Clima: ${context.server?.weather ?? 'desconocido'}
- Dimensión: ${context.server?.dimension ?? 'desconocida'}
- Bioma: ${context.server?.biome ?? 'desconocido'}
- Jugadores conectados:\n${players}
- Mods cargados: ${mods}
- Estado del bot: vida ${context.bot?.health ?? '?'}, hambre ${context.bot?.food ?? '?'}`;
}
