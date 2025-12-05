import React, { useState } from 'react';
import { serialManager } from '../lib/serial';
import { CMD } from '../lib/protocol';

interface STM32OptionBytesProps {
    connected: boolean;
    isBusy: boolean;
    onBusyChange: (busy: boolean) => void;
    onLog: (message: string) => void;
}

interface OptionBytes {
    rdp: number;        // Read Protection
    user: number;       // User Option Bytes
    wrp0: number;       // Write Protection 0
    wrp1: number;       // Write Protection 1
}

const RDP_LEVELS: Record<number, { name: string; desc: string; color: string }> = {
    0xAA: { name: 'Level 0', desc: 'No protection', color: 'text-emerald-400' },
    0x00: { name: 'Level 1', desc: 'Read protection active', color: 'text-amber-400' },
    0xCC: { name: 'Level 2', desc: 'Chip permanently locked', color: 'text-rose-400' },
};

export const STM32OptionBytes: React.FC<STM32OptionBytesProps> = ({
    connected,
    isBusy,
    onBusyChange,
    onLog
}) => {
    const [optionBytes, setOptionBytes] = useState<OptionBytes | null>(null);

    const handleReadOptionBytes = async () => {
        if (!connected || isBusy) return;
        onBusyChange(true);
        onLog('Reading STM32 option bytes...');

        try {
            // Init SWD
            await serialManager.sendCommand(CMD.SWD_INIT);

            // Configure MEM-AP
            const csw = new Uint8Array([0, 0x00, 0x00, 0x00, 0x00, 0x52, 0x00, 0x00, 0x23]);
            await serialManager.sendCommand(CMD.SWD_WRITE, csw);

            // Read Option Bytes from 0x1FFFF800 (Flash Option Bytes base for STM32F1)
            const baseAddr = 0x1FFFF800;

            // Read RDP (offset 0x00)
            const readWord = async (offset: number) => {
                const addr = baseAddr + offset;
                const tar = new Uint8Array([0, 0x04, 0x00, 0x00, 0x00, addr & 0xFF, (addr >> 8) & 0xFF, (addr >> 16) & 0xFF, (addr >> 24) & 0xFF]);
                await serialManager.sendCommand(CMD.SWD_WRITE, tar);

                const drw = new Uint8Array([0, 0x0C, 0x00, 0x00, 0x00]);
                const resp = await serialManager.sendCommand(CMD.SWD_READ, drw);

                return resp[0] | (resp[1] << 8) | (resp[2] << 16) | (resp[3] << 24);
            };

            const rdpWord = await readWord(0x00);
            const userWord = await readWord(0x04);
            const wrp0Word = await readWord(0x08);
            const wrp1Word = await readWord(0x0C);

            const ob: OptionBytes = {
                rdp: rdpWord & 0xFF,
                user: (userWord >> 16) & 0xFF,
                wrp0: (wrp0Word >> 16) & 0xFF,
                wrp1: (wrp1Word >> 16) & 0xFF,
            };

            setOptionBytes(ob);
            onLog(`Option bytes read: RDP=0x${ob.rdp.toString(16).padStart(2, '0')}`);
        } catch (err) {
            console.error(err);
            onLog(`Option bytes read failed: ${err}`);
        } finally {
            onBusyChange(false);
        }
    };

    const getRDPLevel = () => {
        if (!optionBytes) return null;
        return RDP_LEVELS[optionBytes.rdp] || { name: 'Unknown', desc: `Value: 0x${optionBytes.rdp.toString(16)}`, color: 'text-slate-400' };
    };

    const getUserFlags = () => {
        if (!optionBytes) return [];
        const user = optionBytes.user;
        return [
            { name: 'WDG_SW', value: !!(user & 0x01), desc: 'Software watchdog' },
            { name: 'nRST_STOP', value: !!(user & 0x02), desc: 'Reset on STOP mode' },
            { name: 'nRST_STDBY', value: !!(user & 0x04), desc: 'Reset on STANDBY mode' },
        ];
    };

    const rdpLevel = getRDPLevel();

    return (
        <div className="bg-white dark:bg-slate-900 border border-dashboard-border-light dark:border-dashboard-border-dark rounded-lg p-6 shadow-sm transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />

            <h2 className="text-sm font-bold mb-4 text-slate-600 dark:text-slate-300 flex items-center gap-2 font-mono uppercase tracking-wider">
                <span className="text-blue-500">🔒</span> Option Bytes
            </h2>

            {optionBytes ? (
                <div className="space-y-4">
                    {/* Read Protection Level */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-mono uppercase tracking-wider">Read Protection</div>
                        <div className="flex items-center justify-between">
                            <span className={`font-mono font-bold text-lg ${rdpLevel?.color}`}>
                                {rdpLevel?.name}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                0x{optionBytes.rdp.toString(16).padStart(2, '0').toUpperCase()}
                            </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{rdpLevel?.desc}</div>
                        {optionBytes.rdp === 0xCC && (
                            <div className="mt-3 p-2 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-mono rounded">
                                ⚠️ <span className="font-bold">CRITICAL:</span> Level 2 protection is irreversible!
                            </div>
                        )}
                    </div>

                    {/* User Option Bytes */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-mono uppercase tracking-wider">User Configuration</div>
                        <div className="space-y-2">
                            {getUserFlags().map((flag) => (
                                <div key={flag.name} className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-slate-600 dark:text-slate-300">{flag.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{flag.desc}</span>
                                        <span className={`px-2 py-1 text-[10px] rounded ${flag.value ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                            {flag.value ? 'ON' : 'OFF'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Write Protection */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-mono uppercase tracking-wider">Write Protection</div>
                        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">WRP0:</span>
                                <span className="text-cyan-600 dark:text-cyan-400 ml-2 font-bold">0x{optionBytes.wrp0.toString(16).padStart(2, '0').toUpperCase()}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">WRP1:</span>
                                <span className="text-cyan-600 dark:text-cyan-400 ml-2 font-bold">0x{optionBytes.wrp1.toString(16).padStart(2, '0').toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-2 italic">
                            Each bit represents a 4KB sector (0=protected, 1=unprotected)
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 font-mono text-xs">
                    Click READ to fetch option bytes from STM32
                </div>
            )}

            {/* Action Button */}
            <div className="mt-4">
                <button
                    onClick={handleReadOptionBytes}
                    disabled={!connected || isBusy}
                    className="w-full p-2 bg-cyan-100 dark:bg-cyan-900/20 hover:bg-cyan-200 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 font-mono font-bold tracking-wider transition-all disabled:opacity-50 text-xs rounded"
                >
                    READ OPTION BYTES
                </button>
            </div>

            {/* Info */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-300 text-[10px] font-mono rounded">
                ℹ️ <span className="font-bold">INFO:</span> Option bytes are read-only in this viewer. Use ST-Link utilities to modify.
            </div>
        </div>
    );
};
