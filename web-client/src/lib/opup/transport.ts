export interface OPUPTransport {
    /**
     * Connect to the transport (e.g., open serial port)
     */
    connect(): Promise<void>;

    /**
     * Disconnect from the transport
     */
    disconnect(): Promise<void>;

    /**
     * Write data to the transport
     */
    write(data: Uint8Array): Promise<void>;

    /**
     * Register a callback for incoming data
     */
    onData(callback: (data: Uint8Array) => void): void;

    /**
     * Check if connected
     */
    isConnected(): boolean;
}
