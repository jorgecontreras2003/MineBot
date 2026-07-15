import { config } from '../config.js';

/**
 * Historial corto de conversación por jugador.
 */
export class MemoryManager {
  constructor() {
    this.maxSize = config.memory.size;
    /** @type {Map<string, Array<{role: 'user'|'assistant', content: string}>>} */
    this.storage = new Map();
  }

  /**
   * @param {string} player
   * @returns {Array<{role: 'user'|'assistant', content: string}>}
   */
  get(player) {
    return this.storage.get(player) ?? [];
  }

  /**
   * @param {string} player
   * @param {'user'|'assistant'} role
   * @param {string} content
   */
  add(player, role, content) {
    const history = this.get(player);
    history.push({ role, content });
    if (history.length > this.maxSize) {
      history.shift();
    }
    this.storage.set(player, history);
  }

  /**
   * @param {string} player
   */
  clear(player) {
    this.storage.delete(player);
  }
}
