import { config } from '../config.js';
import { RconClient } from './rcon.js';
import { logger } from '../utils/logger.js';

/**
 * Herramientas que el bot puede usar para interactuar con el servidor Minecraft.
 */
export class ToolExecutor {
  constructor() {
    this.rcon = config.rcon.enabled
      ? new RconClient(config.rcon.host, config.rcon.port, config.rcon.password)
      : null;
  }

  /**
   * Ejecuta una función por nombre con los argumentos dados.
   * @param {string} name
   * @param {object} args
   * @returns {Promise<string>}
   */
  async execute(name, args) {
    if (!this.rcon) {
      return 'RCON no está habilitado. Configura RCON_ENABLED=true para usar comandos.';
    }

    try {
      switch (name) {
        case 'execute_command':
          return this.executeCommand(args.command);
        case 'locate_structure':
          return this.locateStructure(args.structure);
        case 'locate_biome':
          return this.locateBiome(args.biome);
        default:
          return `Herramienta desconocida: ${name}`;
      }
    } catch (err) {
      logger.error('Error ejecutando herramienta', { name, args, error: err.message });
      return `Error ejecutando ${name}: ${err.message}`;
    }
  }

  /**
   * Ejecuta un comando de consola permitido.
   * @param {string} command
   * @returns {Promise<string>}
   */
  async executeCommand(command) {
    const base = command.trim().split(/\s+/)[0].toLowerCase();
    const allowed = [
      'locate',
      'list',
      'seed',
      'time',
      'weather',
      'data',
      'help',
      'gametick',
      'forceload',
      'worldborder',
      'difficulty',
      'gamerule',
    ];

    if (!allowed.includes(base)) {
      return `Comando no permitido por seguridad: ${base}. Solo se permiten comandos de lectura/info.`;
    }

    const result = await this.rcon.execute(command);
    return result || '(sin salida)';
  }

  /**
   * Busca una estructura cercana.
   * @param {string} structure
   * @returns {Promise<string>}
   */
  async locateStructure(structure) {
    const result = await this.rcon.execute(`/locate structure ${structure}`);
    return result || 'No se encontró la estructura cerca.';
  }

  /**
   * Busca un bioma cercano.
   * @param {string} biome
   * @returns {Promise<string>}
   */
  async locateBiome(biome) {
    const result = await this.rcon.execute(`/locate biome ${biome}`);
    return result || 'No se encontró el bioma cerca.';
  }

  close() {
    if (this.rcon) {
      this.rcon.close();
    }
  }
}

/**
 * Definición de herramientas para la Responses API de OpenAI.
 * @returns {Array<object>}
 */
export function buildTools() {
  const tools = [];

  if (config.openai.webSearch) {
    tools.push({ type: 'web_search' });
  }

  if (config.rcon.enabled) {
    tools.push(
      {
        type: 'function',
        name: 'execute_command',
        description: 'Ejecuta un comando de consola del servidor Minecraft. Solo permite comandos de lectura/información como locate, list, seed, time, weather, data, help.',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Comando completo a ejecutar, incluyendo la barra inicial. Ejemplo: /locate structure minecraft:village',
            },
          },
          required: ['command'],
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'locate_structure',
        description: 'Busca la estructura más cercana del tipo indicado. Devuelve coordenadas.',
        parameters: {
          type: 'object',
          properties: {
            structure: {
              type: 'string',
              description: 'ID de la estructura, ej: minecraft:village, minecraft:desert_pyramid, minecraft:bastion_remnant',
            },
          },
          required: ['structure'],
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'locate_biome',
        description: 'Busca el bioma más cercano del tipo indicado. Devuelve coordenadas.',
        parameters: {
          type: 'object',
          properties: {
            biome: {
              type: 'string',
              description: 'ID del bioma, ej: minecraft:desert, minecraft:jungle, minecraft:badlands',
            },
          },
          required: ['biome'],
          additionalProperties: false,
        },
      }
    );
  }

  return tools;
}
