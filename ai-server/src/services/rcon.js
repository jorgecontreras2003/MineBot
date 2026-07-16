import net from 'net';
import { logger } from '../utils/logger.js';

/**
 * Cliente RCON minimalista para ejecutar comandos en un servidor de Minecraft.
 *
 * RCON es un protocolo binario simple de Valve:
 *   int32 length
 *   int32 requestId
 *   int32 type
 *   byte[] payload (null-terminated)
 *   byte   padding (0x00)
 */
export class RconClient {
  constructor(host, port, password) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.requestId = 0;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Conecta y autentica contra el servidor RCON.
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected && this.authenticated) return;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._destroy();
        reject(new Error('RCON connection timeout'));
      }, 5000);

      this.socket = new net.Socket();

      this.socket.on('data', (data) => this._onData(data));
      this.socket.on('error', (err) => {
        clearTimeout(timer);
        this._destroy();
        reject(err);
      });
      this.socket.on('close', () => {
        this.connected = false;
        this.authenticated = false;
      });

      this.socket.connect(this.port, this.host, async () => {
        logger.info('RCON conectado, autenticando...');
        try {
          await this._authenticate();
          clearTimeout(timer);
          this.authenticated = true;
          logger.info('RCON autenticado correctamente');
          resolve();
        } catch (err) {
          clearTimeout(timer);
          this._destroy();
          reject(err);
        }
      });
    });
  }

  /**
   * Ejecuta un comando en el servidor y devuelve la salida.
   * @param {string} command
   * @returns {Promise<string>}
   */
  async execute(command) {
    await this.connect();
    return this._send(2, command);
  }

  /**
   * Cierra la conexión RCON.
   */
  close() {
    this._destroy();
  }

  async _authenticate() {
    const response = await this._send(3, this.password);
    if (response === '') {
      // Autenticación exitosa: el servidor responde con id no negativo y payload vacío.
      return;
    }
    throw new Error('RCON authentication failed');
  }

  _send(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const packet = this._buildPacket(id, type, payload);

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RCON command timeout: ${payload}`));
      }, 10000);

      this.pending.set(id, { resolve, reject, timer, response: '' });
      this.socket.write(packet);
    });
  }

  _buildPacket(id, type, payload) {
    const body = Buffer.from(payload, 'utf8');
    const length = 10 + body.length; // 4 id + 4 type + body + 2 nulls
    const packet = Buffer.alloc(4 + length);

    packet.writeInt32LE(length, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    body.copy(packet, 12);
    packet.writeUInt8(0, 12 + body.length);
    packet.writeUInt8(0, 13 + body.length);

    return packet;
  }

  _onData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length >= 4) {
      const length = this.buffer.readInt32LE(0);
      if (this.buffer.length < 4 + length) break;

      const id = this.buffer.readInt32LE(4);
      const type = this.buffer.readInt32LE(8);
      const payloadEnd = 4 + length - 2; // antes de los dos nulls
      const payload = this.buffer.toString('utf8', 12, payloadEnd);

      this.buffer = this.buffer.subarray(4 + length);

      if (type === 2 && id === -1) {
        // Auth fallida
        const pending = this.pending.get(0) || this.pending.get(1);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(pending.id || 0);
          pending.reject(new Error('RCON authentication failed'));
        }
        continue;
      }

      const pending = this.pending.get(id);
      if (!pending) continue;

      pending.response += payload;

      // Los comandos de Minecraft terminan con una respuesta completa en un paquete.
      // Esperamos un breve momento por si llega más data relacionada.
      clearTimeout(pending.timer);
      pending.timer = setTimeout(() => {
        this.pending.delete(id);
        pending.resolve(pending.response.trim());
      }, 100);
    }
  }

  _destroy() {
    this.connected = false;
    this.authenticated = false;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error('RCON connection closed'));
    }
    this.pending.clear();
  }
}
