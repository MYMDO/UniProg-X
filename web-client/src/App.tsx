
import { useState, useEffect } from 'react'
import { serialManager } from './lib/serial'
import { CMD } from './lib/protocol'
import { HexEditor } from './components/HexEditor'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Log } from './components/Log'
import { ChipDef, CHIP_DB } from './lib/chips'

function App() {
    const [connected, setConnected] = useState(false)
    const [log, setLog] = useState<string[]>([])
    const [selectedChip, setSelectedChip] = useState<ChipDef>(CHIP_DB[0])
    const [memoryData, setMemoryData] = useState<Uint8Array>(new Uint8Array(256).fill(0xFF))
    const [progress, setProgress] = useState(0)
    const [isBusy, setIsBusy] = useState(false)

    useEffect(() => {
        const handleData = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { cmd, payload } = customEvent.detail;
            const payloadHex = Array.from(payload).map((b: any) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            setLog(prev => [...prev.slice(-49), `RX: CMD=${cmd.toString(16).toUpperCase()} LEN=${payload.length} DATA=${payloadHex}`]);
        };
        window.addEventListener('serial-data', handleData);
        return () => window.removeEventListener('serial-data', handleData);
    }, []);

    const handleConnect = async () => {
        if (connected) {
            await serialManager.disconnect()
            setConnected(false)
            setLog(prev => [...prev.slice(-49), 'System Disconnected'])
        } else {
            const success = await serialManager.connect()
            if (success) {
                setConnected(true)
                setLog(prev => [...prev.slice(-49), 'System Connected'])
            }
        }
    }

    const handleScanI2C = async () => {
        if (!connected || isBusy) return
        setIsBusy(true)
        setLog(prev => [...prev.slice(-49), 'Scanning I2C Bus...'])

        try {
            const response = await serialManager.sendCommand(CMD.I2C_SCAN);
            const count = response[0];
            if (count === 0) {
                setLog(prev => [...prev.slice(-49), 'I2C Scan: No devices found']);
            } else {
                const addresses = Array.from(response.slice(1, 1 + count));
                const addressStrings = addresses.map(a => '0x' + a.toString(16).toUpperCase().padStart(2, '0'));
                setLog(prev => [...prev.slice(-49), `I2C Scan: Found ${count} devices: ${addressStrings.join(', ')}`]);

                // Auto-select chip if a known I2C EEPROM is detected
                if (addresses.includes(0x50) || addresses.includes(0x51) || addresses.includes(0x52)) {
                    const detectedChip = CHIP_DB.find(c => c.name === '24C02');
                    if (detectedChip && selectedChip.name !== detectedChip.name) {
                        setSelectedChip(detectedChip);
                        setLog(prev => [...prev.slice(-49), `Auto-selected: ${detectedChip.name} (0x50)`]);
                    }
                }
            }
        } catch (err) {
            console.error(err)
            setLog(prev => [...prev.slice(-49), `I2C Scan Failed: ${err}`])
        } finally {
            setIsBusy(false)
        }
    }

    const handleScanSPI = async () => {
        if (!connected || isBusy) return
        setIsBusy(true)
        setLog(prev => [...prev.slice(-49), 'Scanning SPI Bus...'])

        try {
            const response = await serialManager.sendCommand(CMD.SPI_SCAN);
            const count = response[0];
            if (count === 0) {
                setLog(prev => [...prev.slice(-49), 'SPI Scan: No flash chip detected']);
            } else {
                const mfgID = response[1];
                const devID = (response[2] << 8) | response[3];
                setLog(prev => [...prev.slice(-49), `SPI Scan: Found chip - Mfg:0x${mfgID.toString(16).padStart(2, '0')} Dev:0x${devID.toString(16).padStart(4, '0')}`]);

                // Auto-detect Winbond W25QXX chips (Manufacturer ID: 0xEF)
                if (mfgID === 0xEF) {
                    // Device ID matching for common Winbond chips
                    if ((devID & 0xFF00) === 0x40) {
                        const sizeCode = devID & 0xFF;
                        const sizeMap: Record<number, string> = {
                            0x15: 'W25Q16', 0x16: 'W25Q32', 0x17: 'W25Q64',
                            0x18: 'W25Q128', 0x19: 'W25Q256'
                        };
                        const chipName = sizeMap[sizeCode];
                        if (chipName) {
                            const detectedChip = CHIP_DB.find(c => c.name === chipName);
                            if (detectedChip) {
                                if (selectedChip.name !== detectedChip.name) {
                                    setSelectedChip(detectedChip);
                                    setLog(prev => [...prev.slice(-49), `Auto-selected: ${detectedChip.name} (Winbond)`]);
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err)
            setLog(prev => [...prev.slice(-49), `SPI Scan Failed: ${err}`])
        } finally {
            setIsBusy(false)
        }
    }

    const handleRead = async () => {
        if (!connected || isBusy) return
        setIsBusy(true)
        setProgress(0)
        setLog(prev => [...prev.slice(-49), `Reading ${selectedChip.name}...`])

        try {
            const newData = new Uint8Array(selectedChip.size)
            const chunkSize = 64 // Max payload size

            // For demo purposes, if chip is large, we might want to read less or optimize
            // But with virtualized HexEditor, we can handle it.

            for (let i = 0; i < selectedChip.size; i += chunkSize) {
                const len = Math.min(chunkSize, selectedChip.size - i);

                const payload = new Uint8Array(3);
                payload[0] = selectedChip.address || 0x50;
                payload[1] = len & 0xFF;
                payload[2] = (len >> 8) & 0xFF;

                const response = await serialManager.sendCommand(CMD.I2C_READ, payload);

                if (response.length === len) {
                    newData.set(response, i);
                } else {
                    throw new Error("Invalid response length");
                }

                setProgress(Math.round(((i + chunkSize) / selectedChip.size) * 100))

                // Yield to UI loop occasionally
                if (i % (chunkSize * 10) === 0) await new Promise(r => setTimeout(r, 0));
            }

            setMemoryData(newData)
            setLog(prev => [...prev.slice(-49), 'Read Complete'])
        } catch (err) {
            console.error(err)
            setLog(prev => [...prev.slice(-49), 'Read Failed'])
        } finally {
            setIsBusy(false)
            setProgress(0)
        }
    }

    const handleWrite = async () => {
        if (!connected || isBusy) return
        setIsBusy(true)
        setProgress(0)
        setLog(prev => [...prev.slice(-49), `Writing ${memoryData.length} bytes to ${selectedChip.name}...`])

        try {
            const chunkSize = selectedChip.pageSize || 16; // Use chip's page size

            for (let i = 0; i < memoryData.length; i += chunkSize) {
                const len = Math.min(chunkSize, memoryData.length - i);

                // Payload: [I2C_Addr][Data...]
                const payload = new Uint8Array(1 + len);
                payload[0] = selectedChip.address || 0x50;
                payload.set(memoryData.slice(i, i + len), 1);

                await serialManager.sendCommand(CMD.I2C_WRITE, payload);

                // Wait for EEPROM write cycle (typically 5-10ms)
                await new Promise(r => setTimeout(r, 10));

                setProgress(Math.round(((i + chunkSize) / memoryData.length) * 100))

                // Yield to UI occasionally
                if (i % (chunkSize * 10) === 0) await new Promise(r => setTimeout(r, 0));
            }

            setLog(prev => [...prev.slice(-49), 'Write Complete'])
        } catch (err) {
            console.error(err)
            setLog(prev => [...prev.slice(-49), `Write Failed: ${err}`])
        } finally {
            setIsBusy(false)
            setProgress(0)
        }
    }

    const handleVerify = async () => {
        if (!connected || isBusy) return
        setIsBusy(true)
        setProgress(0)
        setLog(prev => [...prev.slice(-49), `Verifying ${selectedChip.name}...`])

        try {
            const chunkSize = 64;
            let errors = 0;

            for (let i = 0; i < memoryData.length; i += chunkSize) {
                const len = Math.min(chunkSize, memoryData.length - i);

                const payload = new Uint8Array(3);
                payload[0] = selectedChip.address || 0x50;
                payload[1] = len & 0xFF;
                payload[2] = (len >> 8) & 0xFF;

                const response = await serialManager.sendCommand(CMD.I2C_READ, payload);

                // Compare with current memory
                for (let j = 0; j < len; j++) {
                    if (response[j] !== memoryData[i + j]) {
                        errors++;
                        setLog(prev => [...prev.slice(-49), `Mismatch at 0x${(i + j).toString(16)}: expected 0x${memoryData[i + j].toString(16).padStart(2, '0')}, got 0x${response[j].toString(16).padStart(2, '0')}`]);
                    }
                }

                setProgress(Math.round(((i + chunkSize) / memoryData.length) * 100))

                if (i % (chunkSize * 10) === 0) await new Promise(r => setTimeout(r, 0));
            }

            if (errors === 0) {
                setLog(prev => [...prev.slice(-49), 'Verify Complete: All bytes match ✓'])
            } else {
                setLog(prev => [...prev.slice(-49), `Verify Failed: ${errors} mismatches found`])
            }
        } catch (err) {
            console.error(err)
            setLog(prev => [...prev.slice(-49), `Verify Failed: ${err}`])
        } finally {
            setIsBusy(false)
            setProgress(0)
        }
    }

    const handleErase = async () => {
        if (!connected || isBusy) return
        setIsBusy(true)
        setProgress(0)
        setLog(prev => [...prev.slice(-49), `Erasing ${selectedChip.name} (filling with 0xFF)...`])

        try {
            const chunkSize = selectedChip.pageSize || 16;
            const eraseData = new Uint8Array(chunkSize).fill(0xFF);

            for (let i = 0; i < selectedChip.size; i += chunkSize) {
                const len = Math.min(chunkSize, selectedChip.size - i);

                const payload = new Uint8Array(1 + len);
                payload[0] = selectedChip.address || 0x50;
                payload.set(eraseData.slice(0, len), 1);

                await serialManager.sendCommand(CMD.I2C_WRITE, payload);
                await new Promise(r => setTimeout(r, 10));

                setProgress(Math.round(((i + chunkSize) / selectedChip.size) * 100))

                if (i % (chunkSize * 10) === 0) await new Promise(r => setTimeout(r, 0));
            }

            // Update local memory view
            setMemoryData(new Uint8Array(selectedChip.size).fill(0xFF))
            setLog(prev => [...prev.slice(-49), 'Erase Complete'])
        } catch (err) {
            console.error(err)
            setLog(prev => [...prev.slice(-49), `Erase Failed: ${err}`])
        } finally {
            setIsBusy(false)
            setProgress(0)
        }
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer
            const data = new Uint8Array(arrayBuffer)

            // Resize or pad to chip size
            const chipData = new Uint8Array(selectedChip.size).fill(0xFF)
            chipData.set(data.slice(0, selectedChip.size))

            setMemoryData(chipData)
            setLog(prev => [...prev.slice(-49), `Loaded ${data.length} bytes from ${file.name}`])
        }
        reader.readAsArrayBuffer(file)
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8 font-sans selection:bg-cyan-500/30">
            <div className="max-w-[1600px] mx-auto">
                <Header connected={connected} onConnect={handleConnect} />

                <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <Sidebar
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
                    />

                    <div className="lg:col-span-9 flex flex-col gap-8 h-[calc(100vh-200px)]">
                        <div className="bg-slate-900/80 border border-white/10 rounded-none backdrop-blur-md flex flex-col h-full relative overflow-hidden p-6">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                                        <span className="text-emerald-400">03.</span> Memory Matrix
                                    </h2>
                                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">
                                        {memoryData.length.toLocaleString()} BYTES LOADED
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <label className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-mono text-sm font-bold tracking-wider transition-all cursor-pointer">
                                        LOAD FILE
                                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".bin,.hex,.eep" />
                                    </label>
                                    <button
                                        className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 font-mono text-sm font-bold tracking-wider transition-all"
                                        onClick={() => {
                                            const blob = new Blob([new Uint8Array(memoryData)], { type: 'application/octet-stream' })
                                            const url = URL.createObjectURL(blob)
                                            const a = document.createElement('a')
                                            a.href = url
                                            a.download = `${selectedChip.name}_backup.bin`
                                            a.click()
                                            URL.revokeObjectURL(url)
                                            setLog(prev => [...prev.slice(-49), `Saved backup to ${selectedChip.name}_backup.bin`])
                                        }}
                                    >
                                        SAVE FILE
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1">
                                <HexEditor data={memoryData} />
                            </div>
                        </div>
                        <div className="lg:hidden">
                            <Log logs={log} />
                        </div>
                    </div>

                    <div className="hidden lg:block lg:col-span-3">
                        {/* Spacer or additional sidebar content if needed */}
                    </div>
                    <div className="hidden lg:block lg:col-span-12">
                        <Log logs={log} />
                    </div>
                </main>
            </div>
        </div>
    )
}

export default App

