import { MAGIC_BYTE } from './protocol';

export class SerialManager {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private keepReading = false;

  private currentResolver: ((data: Uint8Array) => void) | null = null;
  private currentRejecter: ((reason?: any) => void) | null = null;

  async connect() {
    if (!('serial' in navigator)) {
      const error = "Web Serial API not supported. Please use Google Chrome, Microsoft Edge, or Opera.";
      alert(error);
      console.error(error);
      return false;
    }

    try {
      // Request any serial port (no filters) to ensure compatibility
      this.port = await navigator.serial.requestPort({});
      await this.port.open({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
        bufferSize: 4096 // Match firmware buffer
      });

      // Some devices need DTR to start sending data
      await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });

      this.keepReading = true;
      this.readLoop();
      return true;
    } catch (err) {
      console.error('Error connecting:', err);
      alert(`Connection Failed: ${err}`); // Give user immediate feedback
      return false;
    }
  }

  async disconnect() {
    this.keepReading = false;
    if (this.reader) {
      await this.reader.cancel();
    }
    if (this.writer) {
      await this.writer.close();
    }
    if (this.port) {
      await this.port.close();
    }
    this.port = null;
  }

  private async readLoop() {
    if (!this.port?.readable) return;

    try {
      this.reader = this.port.readable.getReader();

      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.processData(value);
        }
      }
    } catch (err) {
      console.error('Read error:', err);
    } finally {
      if (this.reader) {
        this.reader.releaseLock();
        this.reader = null;
      }
    }
  }

  private buffer: Uint8Array = new Uint8Array(0);

  private processData(chunk: Uint8Array) {
    const newBuffer = new Uint8Array(this.buffer.length + chunk.length);
    newBuffer.set(this.buffer);
    newBuffer.set(chunk, this.buffer.length);
    this.buffer = newBuffer;

    while (this.buffer.length >= 4) {
      if (this.buffer[0] !== MAGIC_BYTE) {
        const magicIndex = this.buffer.indexOf(MAGIC_BYTE);
        if (magicIndex === -1) {
          this.buffer = new Uint8Array(0);
          return;
        }
        this.buffer = this.buffer.slice(magicIndex);
        continue;
      }

      const len = this.buffer[2] | (this.buffer[3] << 8);
      const packetSize = 4 + len + 1;

      if (this.buffer.length < packetSize) return;

      const packet = this.buffer.slice(0, packetSize);
      this.handlePacket(packet);
      this.buffer = this.buffer.slice(packetSize);
    }
  }

  private handlePacket(packet: Uint8Array) {
    const cmd = packet[1];
    const len = packet[2] | (packet[3] << 8);
    const payload = packet.slice(4, 4 + len);

    // Log for debug
    const event = new CustomEvent('serial-data', { detail: { cmd, payload } });
    window.dispatchEvent(event);

    // If we have a pending transaction, resolve it
    if (this.currentResolver) {
      if (cmd === 0xFF) {
        const errorCode = payload[0];
        const errorMap: Record<number, string> = {
          0x01: "INVALID_CMD",
          0x02: "CRC_ERROR",
          0x03: "TIMEOUT",
          0x04: "NACK (No Chip Response)",
          0x05: "BUFFER_OVERFLOW"
        };
        this.currentRejecter?.(new Error(`Device Error: ${errorMap[errorCode] || 'Unknown'} (0x${errorCode.toString(16)})`));
      } else {
        this.currentResolver(payload);
      }
      this.currentResolver = null;
      this.currentRejecter = null;
    }
  }

  async sendCommand(cmd: number, payload: Uint8Array = new Uint8Array(0)): Promise<Uint8Array> {
    if (!this.port?.writable) throw new Error("Not connected");

    // Wait if there is already a transaction in progress (simple lock)
    while (this.currentResolver) {
      await new Promise(r => setTimeout(r, 10));
    }

    return new Promise<Uint8Array>(async (resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.currentResolver = null;
        this.currentRejecter = null;
        reject(new Error("Timeout"));
      }, 1000);

      this.currentResolver = (data) => {
        clearTimeout(timeout);
        resolve(data);
      };
      this.currentRejecter = (err) => {
        clearTimeout(timeout);
        reject(err);
      };

      try {
        const len = payload.length;
        const packet = new Uint8Array(4 + len + 1);

        packet[0] = MAGIC_BYTE;
        packet[1] = cmd;
        packet[2] = len & 0xFF;
        packet[3] = (len >> 8) & 0xFF;
        packet.set(payload, 4);

        // CRC (Simple Sum)
        let crc = cmd + (len & 0xFF) + ((len >> 8) & 0xFF);
        for (let i = 0; i < len; i++) crc += payload[i];
        packet[4 + len] = crc;

        if (!this.port) throw new Error("Port disconnected");

        const writer = this.port.writable.getWriter();
        await writer.write(packet);
        writer.releaseLock();
      } catch (e) {
        clearTimeout(timeout);
        this.currentResolver = null;
        this.currentRejecter = null;
        reject(e);
      }
    });
  }
}

export const serialManager = new SerialManager();

