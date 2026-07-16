/**
 * Catálogo de herramientas disponibles para el LLM.
 *
 * Cada herramienta representa una función específica del mod. El AI Server solo
 * define las herramientas; su ejecución la realiza el mod usando la API de Fabric.
 */
export const TOOL_REGISTRY = [
  {
    name: 'getServerInfo',
    description: 'Obtiene el estado general del servidor: jugadores conectados, máximo, dificultad, clima, hora, dimensión, TPS y MSPT.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getPlayers',
    description: 'Obtiene la lista de jugadores conectados con posición, dimensión, vida, comida, modo de juego y experiencia.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getPlayer',
    description: 'Obtiene información detallada de un jugador específico por su nombre.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getPlayerHealth',
    description: 'Obtiene vida, hambre, experiencia y estado de muerte de un jugador.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getPlayerPosition',
    description: 'Obtiene coordenadas, dimensión y bioma de un jugador.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getPlayerInventory',
    description: 'Obtiene el inventario de un jugador (si el servidor lo permite).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getPlayerEquipment',
    description: 'Obtiene armadura y objetos en las manos de un jugador.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getWorldInfo',
    description: 'Obtiene información del mundo: hora, clima, dificultad, spawn y semilla (si está habilitada).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getSpawn',
    description: 'Obtiene las coordenadas del spawn del mundo.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getBedLocation',
    description: 'Obtiene la ubicación de la cama/respawn de un jugador.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getNearbyPlayers',
    description: 'Obtiene los jugadores cercanos a un jugador dentro de un radio.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
        radius: { type: 'number', description: 'Radio en bloques. Por defecto 50.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getNearbyEntities',
    description: 'Obtiene las entidades cercanas a un jugador dentro de un radio.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
        radius: { type: 'number', description: 'Radio en bloques. Por defecto 50.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getScoreboard',
    description: 'Obtiene los objetivos y puntuaciones del scoreboard.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getBiome',
    description: 'Obtiene el bioma en la posición de un jugador.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'locateBiome',
    description: 'Encuentra las coordenadas del bioma más cercano del tipo solicitado.',
    parameters: {
      type: 'object',
      properties: {
        biome: { type: 'string', description: 'Identificador del bioma, ej: minecraft:cherry_grove.' },
      },
      required: ['biome'],
    },
  },
  {
    name: 'locateStructure',
    description: 'Encuentra las coordenadas de la estructura más cercana del tipo solicitado.',
    parameters: {
      type: 'object',
      properties: {
        structure: { type: 'string', description: 'Identificador de la estructura, ej: minecraft:stronghold.' },
      },
      required: ['structure'],
    },
  },
  {
    name: 'sendChatMessage',
    description: 'Envía un mensaje de chat como el bot.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto del mensaje a enviar.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'showTitle',
    description: 'Muestra un título y subtítulo a un jugador.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
        title: { type: 'string', description: 'Título principal.' },
        subtitle: { type: 'string', description: 'Subtítulo.' },
      },
      required: ['name', 'title'],
    },
  },
  {
    name: 'playSound',
    description: 'Reproduce un sonido para un jugador.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre exacto del jugador.' },
        sound: { type: 'string', description: 'Identificador del sonido, ej: minecraft:entity.player.levelup.' },
      },
      required: ['name', 'sound'],
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
