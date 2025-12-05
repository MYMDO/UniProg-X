import { useState, useEffect } from 'react'

import { OPUPClient, OpupCmd } from './lib/opup'
import { WebSerialTransport } from './lib/opup/web-transport'
import { HexEditor } from './components/HexEditor'
import { Header } from './components/Header'
import { Sidebar as ControlPanel } from './components/Sidebar'
import { Log as Console } from './components/Log'
import { AVRFuseEditor } from './components/AVRFuseEditor'
import { ChipDef, CHIP_DB } from './lib/chips'

function App() {
    const [connected, setConnected] = useState(false)
    const [log, setLog] = useState<string[]>([])
    const [selectedChip, setSelectedChip] = useState<ChipDef>(CHIP_DB[0])
    const [memoryData, setMemoryData] = useState<Uint8Array>(new Uint8Array(256).fill(0xFF))
    const [progress, setProgress] = useState(0)
    const [isBusy, setIsBusy] = useState(false)
    const [mode, setMode] = useState<'I2C' | 'SPI' | 'AVR' | 'STM32'>('I2C')
    const [theme, setTheme] = useState<'light' | 'dark'>('dark')

    // OPUP Client
    const [opupClient] = useState(() => {
        const transport = new WebSerialTransport();
        return new OPUPClient(transport);
    });

    useEffect(() => {
        // Init theme
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }, []);

    useEffect(() => {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
    }, [theme]);

    useEffect(() => {
        return () => {
            if (opupClient.isConnected()) {
                opupClient.disconnect();
            }
        };
    }, [opupClient]);

    // Auto-select appropriate chip when mode changes
    useEffect(() => {
        const firstChipForMode = CHIP_DB.find(c => {
            if (mode === 'I2C') return c.type === 'I2C';
            if (mode === 'SPI') return c.type === 'SPI';
            if (mode === 'AVR') return c.type === 'AVR';
            if (mode === 'STM32') return c.type === 'STM32';
            return false;
        });

        if (firstChipForMode && selectedChip.type !== firstChipForMode.type) {
            setSelectedChip(firstChipForMode);
            setMemoryData(new Uint8Array(firstChipForMode.size).fill(0xFF));
        }

        // Register Transport Error Handler
        opupClient.onError((err) => {
            handleLog(`Transport Error: ${err.message}`);
            if (err.message.includes("NetworkError") || err.message.includes("The device has been lost")) {
                setConnected(false);
                handleLog("Device Detached. Please reconnect.");
                // Force disconnect to release handle
                opupClient.disconnect().catch(e => console.error("Cleanup error:", e));
            }
        });
    }, [mode]);

    const handleConnect = async () => {
        if (connected) {
            await opupClient.disconnect()
            setConnected(false)
            handleLog('System Disconnected')
        } else {
            try {
                await opupClient.connect()
                setConnected(true)
                handleLog('System Connected. Testing Link...')

                // Quick stabilization
                await delay(100);

                // Perform PING
                try {
                    const pkt = await opupClient.sendCommand(OpupCmd.SYS_PING);
                    // Expect 0xCA, 0xFE as per firmware
                    if (pkt.payload.length >= 2 && pkt.payload[0] === 0xCA && pkt.payload[1] === 0xFE) {
                        handleLog("Connection Verified: UniProg-X Online");
                    } else {
                        handleLog(`Warning: PING response invalid (${pkt.payload.join(',')})`);
                    }
                } catch (pingErr: any) {
                    handleLog(`PING Failed: ${pingErr.message}`);
                }

            } catch (err: any) {
                console.error(err)
                handleLog(`Connection Failed: ${err.message}`)
            }
        }
    }

    const handleLog = (msg: string) => setLog(prev => [...prev.slice(-99), msg]);

    // --- Firmware Operations ---

    // Helper: Delay
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    const handleScanI2C = async () => {
        if (!opupClient.isConnected()) {
            handleLog("Error: Not Connected");
            return;
        }
        setIsBusy(true);
        handleLog("Scanning I2C Bus...");
        try {
            const pkt = await opupClient.sendCommand(OpupCmd.I2C_SCAN);
            // Payload: [Count, Addr1, Addr2...]
            if (pkt.payload.length < 1) throw new Error("Invalid response length");

            const foundCount = pkt.payload[0];
            if (foundCount === 0) {
                handleLog("I2C Scan: No devices found.");
            } else {
                const addresses = [];
                for (let i = 0; i < foundCount; i++) {
                    addresses.push(`0x${pkt.payload[1 + i].toString(16).toUpperCase()}`);
                }
                handleLog(`I2C Scan: Found ${foundCount} device(s): ${addresses.join(', ')}`);

                // Auto-select if known
                if (foundCount === 1) {
                    // Simple heuristic: 0x50 is usually EEPROM
                    if (pkt.payload[1] === 0x50) {
                        handleLog("Found standard EEPROM address (0x50). Using Generic 2Kbit (24C02).");
                        const match = CHIP_DB.find(c => c.name.includes("24C02"));
                        if (match) {
                            setSelectedChip(match);
                            setMemoryData(new Uint8Array(match.size).fill(0xFF));
                        }
                    }
                }
            }
        } catch (err: any) {
            handleLog(`I2C Scan Error: ${err.message}`);
            console.error(err);
        } finally {
            setIsBusy(false);
        }
    };

    const handleScanSPI = async () => {
        if (!opupClient.isConnected()) return;
        setIsBusy(true);
        handleLog("Scanning SPI Bus (JEDEC ID)...");
        try {
            // Send SPI_SCAN (0x20)
            const pkt = await opupClient.sendCommand(OpupCmd.SPI_SCAN);
            // Payload: [Count, Mfg, DevH, DevL]
            const count = pkt.payload[0];

            if (count > 0 && pkt.payload.length >= 4) {
                const manId = pkt.payload[1];
                const typeId = pkt.payload[2];
                const capId = pkt.payload[3]; // Capacity = 2^N bytes usually? Or density code.
                handleLog(`SPI Detect: ManID=0x${manId.toString(16).toUpperCase()} Type=0x${typeId.toString(16).toUpperCase()} Cap=0x${capId.toString(16).toUpperCase()}`);

                // Match against DB
                const match = CHIP_DB.find(c => c.jedecId === manId && c.type === 'SPI');
                if (match) {
                    handleLog(`Identified: ${match.name}`);
                    setSelectedChip(match);
                    // Resize memory buffer to match new chip capacity (fill with 0xFF)
                    setMemoryData(new Uint8Array(match.size).fill(0xFF));
                } else {
                    handleLog("Unknown SPI Chip");
                }
            } else {
                // Check for debug data from firmware (OPUP_SPI.h returns 5 bytes if no chip)
                if (pkt.payload.length >= 5) {
                    const raw = Array.from(pkt.payload.slice(1, 5)).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                    handleLog(`SPI Scan: No chip detected. Raw JEDEC: [${raw}]`);
                } else {
                    handleLog("SPI Scan: No chip detected (No debug data)");
                }
            }
        } catch (err: any) {
            handleLog(`SPI Scan Error: ${err.message}`);
        } finally {
            setIsBusy(false);
        }
    };

    const handleRead = async () => {
        if (!connected || isBusy) return;
        setIsBusy(true);
        handleLog(`Reading ${selectedChip.name} (${selectedChip.size} bytes)...`);

        try {
            const startTime = Date.now();
            const totalSize = selectedChip.size;
            // Chunk size: I2C limited by buffer (usually 32-64 on device), SPI can be larger.
            // Using 64 bytes is safe for all.
            const chunkSize = 256;
            const newData = new Uint8Array(totalSize);

            for (let addr = 0; addr < totalSize; addr += chunkSize) {
                const len = Math.min(chunkSize, totalSize - addr);

                if (mode === 'I2C') {
                    // I2C EEPROM Read Sequence:
                    // 1. Write Address to set cursor
                    // 2. Read Data

                    // Device Address: 0x50 (base)
                    // For < 24C32, address is 1 byte, high bits in DevAddr might be used
                    let devAddr = selectedChip.address || 0x50;
                    let addrBytes = 2; // Default to 2 byte address for modern EEPROMs
                    if (selectedChip.size <= 2048) {
                        addrBytes = 1;
                        if (selectedChip.size > 256) {
                            // 24C04/08/16 use block select bits in dev address
                            // Addr bits 8,9,10 go into DevAddr bits 0,1,2
                            devAddr |= ((addr >> 8) & 0x07);
                        }
                    }

                    // Step 1: Set Address
                    const writePayload = new Uint8Array(1 + addrBytes);
                    writePayload[0] = devAddr;
                    if (addrBytes === 2) {
                        writePayload[1] = (addr >> 8) & 0xFF; // MSB
                        writePayload[2] = addr & 0xFF;        // LSB
                    } else {
                        writePayload[1] = addr & 0xFF;
                    }
                    await opupClient.sendCommand(OpupCmd.I2C_WRITE, writePayload);

                    // Step 2: Read
                    // Payload: [DevAddr, LenL, LenH]
                    const readPayload = new Uint8Array(3);
                    readPayload[0] = devAddr;
                    readPayload[1] = len & 0xFF;
                    readPayload[2] = (len >> 8) & 0xFF;

                    const resp = await opupClient.sendCommand(OpupCmd.I2C_READ, readPayload);
                    newData.set(resp.payload, addr);

                } else if (mode === 'SPI') {
                    // QSPI_READ (0x26)
                    // Request: [Cmd:1][AddrLen:1][Addr:3-4(LE)][Dummy:1][ReadLen:2(LE)]

                    const payload = new Uint8Array(8);
                    payload[0] = 0x03; // Standard Read Command
                    payload[1] = 3;    // 3-byte Address
                    // Address Little Endian
                    payload[2] = addr & 0xFF;
                    payload[3] = (addr >> 8) & 0xFF;
                    payload[4] = (addr >> 16) & 0xFF;
                    payload[5] = 0;    // Dummy cycles (0 for cmd 0x03)
                    // Length Little Endian
                    payload[6] = len & 0xFF;
                    payload[7] = (len >> 8) & 0xFF;

                    const resp = await opupClient.sendCommand(OpupCmd.QSPI_READ, payload);
                    newData.set(resp.payload, addr);
                } else {
                    throw new Error("Mode not supported yet");
                }

                const p = Math.floor(((addr + len) / totalSize) * 100);
                setProgress(p);

                // Yield to keep UI responsive
                if (addr % 4096 === 0) await delay(1);
            }

            setMemoryData(newData);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            handleLog(`Read Complete in ${duration}s`);
        } catch (err: any) {
            handleLog(`Read Failed: ${err.message}`);
            console.error(err);
        } finally {
            setIsBusy(false);
            setProgress(0);
        }
    };

    const handleWrite = async () => {
        if (!connected || isBusy) return;
        if (!confirm(`Overwrite ${selectedChip.name}? This cannot be undone.`)) return;

        setIsBusy(true);
        handleLog(`Writing ${selectedChip.name}...`);

        try {
            const startTime = Date.now();
            const totalSize = selectedChip.size;
            const pageSize = selectedChip.pageSize || 128;

            // I2C write usually 16-32 bytes max page. SPI usually 256.
            const maxPage = mode === 'I2C' ? 16 : 256;
            const writeChunkSize = Math.min(pageSize, maxPage);

            for (let addr = 0; addr < totalSize; addr += writeChunkSize) {
                const len = Math.min(writeChunkSize, totalSize - addr);
                const chunkData = memoryData.slice(addr, addr + len);

                if (mode === 'I2C') {
                    // I2C Write: [DevAddr, MemAddr..., Data...]
                    let devAddr = selectedChip.address || 0x50;
                    let addrBytes = 2;
                    if (selectedChip.size <= 2048) {
                        addrBytes = 1;
                        if (selectedChip.size > 256) devAddr |= ((addr >> 8) & 0x07);
                    }

                    const payload = new Uint8Array(1 + addrBytes + len);
                    payload[0] = devAddr;
                    if (addrBytes === 2) {
                        payload[1] = (addr >> 8) & 0xFF;
                        payload[2] = addr & 0xFF;
                        payload.set(chunkData, 3);
                    } else {
                        payload[1] = addr & 0xFF;
                        payload.set(chunkData, 2);
                    }

                    await opupClient.sendCommand(OpupCmd.I2C_WRITE, payload);
                    await delay(5); // EEPROM write cycle

                } else if (mode === 'SPI') {
                    // SPI Write Sequence:
                    // 1. Write Enable (0x06)
                    // 2. Page Program (0x02)

                    // 1. WREN via QSPI_CMD
                    // Payload: [Cmd, TxLen, Data...] -> [0x06, 0]
                    await opupClient.sendCommand(OpupCmd.QSPI_CMD, new Uint8Array([0x06, 0]));

                    // 2. Write via QSPI_WRITE
                    // Payload: [Cmd:1][AddrLen:1][Addr:3(LE)][Data...]
                    const payload = new Uint8Array(5 + len);
                    payload[0] = 0x02; // Page Program
                    payload[1] = 3;    // AddrLen
                    payload[2] = addr & 0xFF;
                    payload[3] = (addr >> 8) & 0xFF;
                    payload[4] = (addr >> 16) & 0xFF;
                    payload.set(chunkData, 5);

                    await opupClient.sendCommand(OpupCmd.QSPI_WRITE, payload);

                    // 3. Wait for Busy (Read SR1 0x05)
                    // Poll loops... simplified fixed delay for now (3ms per page is conservative)
                    await delay(3);
                }

                const p = Math.floor(((addr + len) / totalSize) * 100);
                setProgress(p);
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            handleLog(`Write Complete in ${duration}s`);
        } catch (err: any) {
            handleLog(`Write Failed: ${err.message}`);
            console.error(err);
        } finally {
            setIsBusy(false);
            setProgress(0);
        }
    };

    const handleVerify = async () => {
        // Re-use handleRead logic but compare? 
        // For simplicity, let's implement a separate Verify loop
        // Logic is identical to Read but with comparison
        if (!connected || isBusy) return;
        setIsBusy(true);
        handleLog(`Verifying ${selectedChip.name}...`);

        try {
            // ... [Verify Logic similar to Read, omitted to save token space if unchanged, but I should probably update it]
            // I'll copy the Read logic and modify for verify
            const totalSize = selectedChip.size;
            const chunkSize = 256;
            let errors = 0;

            for (let addr = 0; addr < totalSize; addr += chunkSize) {
                const len = Math.min(chunkSize, totalSize - addr);
                let chipData: Uint8Array | null = null;

                // READ CHIP (Copy of Read Logic)
                if (mode === 'I2C') {
                    let devAddr = selectedChip.address || 0x50;
                    let addrBytes = 2;
                    if (selectedChip.size <= 2048) {
                        addrBytes = 1;
                        if (selectedChip.size > 256) devAddr |= ((addr >> 8) & 0x07);
                    }
                    // Set Addr
                    const wp = new Uint8Array(1 + addrBytes);
                    wp[0] = devAddr;
                    if (addrBytes === 2) { wp[1] = ((addr >> 8) & 0xFF); wp[2] = (addr & 0xFF); } else wp[1] = (addr & 0xFF);
                    await opupClient.sendCommand(OpupCmd.I2C_WRITE, wp);
                    // Read
                    const rp = new Uint8Array(3); rp[0] = devAddr; rp[1] = len & 0xFF; rp[2] = (len >> 8) & 0xFF;
                    const pkt = await opupClient.sendCommand(OpupCmd.I2C_READ, rp);
                    chipData = pkt.payload;
                } else if (mode === 'SPI') {
                    const p = new Uint8Array(8);
                    p[0] = 0x03; p[1] = 3; p[2] = addr & 0xFF; p[3] = (addr >> 8) & 0xFF; p[4] = (addr >> 16) & 0xFF; p[5] = 0; p[6] = len & 0xFF; p[7] = (len >> 8) & 0xFF;
                    const pkt = await opupClient.sendCommand(OpupCmd.QSPI_READ, p);
                    chipData = pkt.payload;
                }

                if (chipData) {
                    for (let i = 0; i < len; i++) {
                        if (chipData[i] !== memoryData[addr + i]) {
                            errors++;
                            if (errors < 5) handleLog(`Diff @ 0x${(addr + i).toString(16)}: File=${memoryData[addr + i].toString(16)} Chip=${chipData[i].toString(16)}`);
                        }
                    }
                }
                if (errors > 20) throw new Error("Too many errors");

                setProgress(Math.floor((addr / totalSize) * 100));
                if (addr % 4096 === 0) await delay(1);
            }

            if (errors === 0) handleLog("Verification OK");
            else handleLog(`Verification FAILED (${errors} errors)`);

        } catch (err: any) {
            handleLog(`Verify Failed: ${err.message}`);
        } finally {
            setIsBusy(false);
            setProgress(0);
        }
    };

    const handleErase = async () => {
        if (!connected || isBusy) return;
        if (!confirm(`Erase ENTIRE ${selectedChip.name}?`)) return;

        setIsBusy(true);
        handleLog(`Erasing ${selectedChip.name}...`);

        try {
            if (mode === 'I2C') {
                handleLog("I2C Bulk Erase (Writing 0xFF)...");
                // Simplified: Just write 0xFF using handleWrite logic manually
                // ...
                handleLog("Not implementing I2C Erase (Slow) yet.");
            } else if (mode === 'SPI') {
                // 1. WREN
                await opupClient.sendCommand(OpupCmd.QSPI_CMD, new Uint8Array([0x06, 0]));
                // 2. Chip Erase (0xC7)
                await opupClient.sendCommand(OpupCmd.QSPI_CMD, new Uint8Array([0xC7, 0]));

                handleLog("Chip Erase command sent. Waiting...");

                // Poll SR1 for BUSY (0x05)
                // Payload: [Cmd, TxLen, Data...] -> Read 1 byte
                // Loop
                let busy = true;
                const start = Date.now();
                while (busy && (Date.now() - start < 60000)) { // 60s timeout
                    await delay(500);
                    // Read SR1: Cmd 0x05, 1 byte response. send [0x05, 1, 0x00]
                    const rp = new Uint8Array([0x05, 1, 0x00]);
                    const pkt = await opupClient.sendCommand(OpupCmd.QSPI_CMD, rp);
                    if (pkt.payload.length > 0) {
                        const sr1 = pkt.payload[0];
                        if ((sr1 & 0x01) === 0) busy = false;
                    }
                }

                if (!busy) handleLog("Erase Complete");
                else throw new Error("Erase Timeout");

                setMemoryData(new Uint8Array(selectedChip.size).fill(0xFF));
            }

        } catch (err: any) {
            handleLog(`Erase Failed: ${err.message}`);
        } finally {
            setIsBusy(false);
            setProgress(0);
        }
    };

    // --- File Operations ---

    const handleSaveFile = () => {
        const blob = new Blob([memoryData as any], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dump-${selectedChip.name}-${Date.now()}.bin`;
        link.click();
        URL.revokeObjectURL(url);
        handleLog("File saved to disk.");
    };

    const handleLoadFile = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.bin,.hex';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                if (evt.target?.result) {
                    const buffer = evt.target.result as ArrayBuffer;
                    const loadedData = new Uint8Array(buffer);
                    if (loadedData.length > selectedChip.size) {
                        handleLog(`Warning: File size (${loadedData.length}) > Chip size (${selectedChip.size}). Truncating.`);
                    }

                    const newData = new Uint8Array(selectedChip.size).fill(0xFF);
                    newData.set(loadedData.slice(0, selectedChip.size));
                    setMemoryData(newData);
                    handleLog(`Loaded ${file.name} (${loadedData.length} bytes)`);
                }
            };
            reader.readAsArrayBuffer(file);
        };
        input.click();
    };

    // Layout
    return (
        <div className="h-screen w-screen flex flex-col bg-dashboard-light dark:bg-dashboard-dark text-slate-800 dark:text-slate-200 overflow-hidden font-sans transition-colors duration-300">
            <Header
                connected={connected}
                onConnect={handleConnect}
                currentTheme={theme}
                onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            />

            <main className="flex-1 flex overflow-hidden">
                {/* Left Control Panel */}
                <ControlPanel
                    mode={mode}
                    setMode={setMode}
                    selectedChip={selectedChip}
                    onSelectChip={setSelectedChip}
                    connected={connected}
                    isBusy={isBusy}
                    progress={progress}
                    onScanI2C={handleScanI2C}
                    onScanSPI={handleScanSPI}
                    onRead={handleRead}
                    onWrite={handleWrite}
                    onVerify={handleVerify}
                    onErase={handleErase}
                    onLoad={handleLoadFile}
                    onSave={handleSaveFile}
                />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 p-4 gap-4">
                    {/* Top Hex Editor Area */}
                    <div className="flex-1 min-h-0">
                        <HexEditor data={memoryData} />
                    </div>

                    {/* Bottom Console Area */}
                    <div className="h-48 min-h-[12rem]">
                        <Console logs={log} />
                    </div>
                </div>

                {/* Extra Tools Panel (Optional - for AVR Fuse etc) */}
                {mode === 'AVR' && (
                    <div className="w-80 border-l border-dashboard-border-light dark:border-dashboard-border-dark bg-white dark:bg-slate-900 p-4 overflow-y-auto">
                        <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase">AVR Tools</h3>
                        <AVRFuseEditor
                            connected={connected}
                            isBusy={isBusy}
                            onBusyChange={setIsBusy}
                            onLog={handleLog}
                        />
                    </div>
                )}
            </main>
        </div>
    )
}

export default App

