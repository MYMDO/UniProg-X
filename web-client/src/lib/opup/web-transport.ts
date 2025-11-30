import { OPUPTransport } from './transport';

export class WebSerialTransport implements OPUPTransport {
    private port: SerialPort | null = null;
    private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    private dataCallback: ((data: Uint8Array) => void) | null = null;
    private keepReading = false;

    async connect(): Promise<void> {
        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: 115200 });
            await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });

            this.keepReading = true;
            this.readLoop();
        } catch (err) {
            console.error('WebSerial connect failed:', err);
            throw err;
        }
    }

    async disconnect(): Promise<void> {
        this.keepReading = false;
        if (this.reader) {
            await this.reader.cancel();
            this.reader.releaseLock();
            this.reader = null;
        }
        if (this.writer) {
            this.writer.releaseLock();
            this.writer = null;
        }
        if (this.port) {
            await this.port.close();
            this.port = null;
        }
    }

    async write(data: Uint8Array): Promise<void> {
        if (!this.port || !this.port.writable) throw new Error("Port not writable");

        console.log('TX:', Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '));
        const writer = this.port.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();
    }

    onData(callback: (data: Uint8Array) => void): void {
        this.dataCallback = callback;
    }

    isConnected(): boolean {
        return this.port !== null && this.port.readable !== null;
    }

    private async readLoop() {
        if (!this.port || !this.port.readable) return;

        try {
            this.reader = this.port.readable.getReader();

            while (this.keepReading) {
                const { value, done } = await this.reader.read();
                if (done) break;
                if (value) {
                    console.log('RX:', Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' '));
                    if (this.dataCallback) {
                        this.dataCallback(value);
                    }
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
}
