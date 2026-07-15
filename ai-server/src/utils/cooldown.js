import { config } from '../config.js';

/**
 * Gestiona cooldowns por jugador para evitar spam.
 */
export class CooldownManager {
  constructor() {
    this.cooldownMs = config.cooldown.seconds * 1000;
    /** @type {Map<string, number>} */
    this.lastUse = new Map();
  }

  /**
   * @param {string} player
   * @returns {{ allowed: boolean, remainingSeconds: number }}
   */
  check(player) {
    const now = Date.now();
    const last = this.lastUse.get(player) ?? 0;
    const remainingMs = last + this.cooldownMs - now;

    if (remainingMs > 0) {
      return {
        allowed: false,
        remainingSeconds: Math.ceil(remainingMs / 1000),
      };
    }

    return { allowed: true, remainingSeconds: 0 };
  }

  /**
   * @param {string} player
   */
  register(player) {
    this.lastUse.set(player, Date.now());
  }
}
