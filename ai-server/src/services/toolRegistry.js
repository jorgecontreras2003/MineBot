/**
 * Catálogo de herramientas disponibles para el LLM.
 *
 * El AI Server solo define las herramientas; su ejecución la realiza el mod de
 * Minecraft a través del ciclo de request/response del chat.
 */
export const TOOL_REGISTRY = [
  {
    name: 'get_server_info',
    description:
      'Obtiene el estado general del servidor: jugadores conectados, máximo, dificultad, clima, hora y dimensión.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_players',
    description: 'Obtiene la lista de jugadores conectados con posición, dimensión, vida, comida y modo de juego.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_player',
    description: 'Obtiene información detallada de un jugador específico por su nombre.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nombre exacto del jugador.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'locate_biome',
    description: 'Encuentra las coordenadas del bioma más cercano del tipo solicitado.',
    parameters: {
      type: 'object',
      properties: {
        biome: {
          type: 'string',
          description: 'Identificador del bioma, ej: minecraft:cherry_grove.',
        },
      },
      required: ['biome'],
    },
  },
  {
    name: 'locate_structure',
    description: 'Encuentra las coordenadas de la estructura más cercana del tipo solicitado.',
    parameters: {
      type: 'object',
      properties: {
        structure: {
          type: 'string',
          description: 'Identificador de la estructura, ej: minecraft:stronghold.',
        },
      },
      required: ['structure'],
    },
  },
  {
    name: 'get_weather',
    description: 'Obtiene el clima actual del mundo (clear, rain o thunder).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_time',
    description: 'Obtiene la hora actual del mundo de Minecraft.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_spawn',
    description: 'Obtiene las coordenadas del spawn del mundo.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'execute_command',
    description:
      'Ejecuta un comando de Minecraft en el servidor. Solo usar para administración; no usar para obtener información si existe una herramienta específica.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Comando a ejecutar sin la barra inicial, ej: time query daytime.',
        },
      },
      required: ['command'],
    },
  },
];

/**
 * Formatea las herramientas para la Responses API de OpenAI.
 * @returns {Array<object>}
 */
export function getOpenAITools() {
  return TOOL_REGISTRY.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}
