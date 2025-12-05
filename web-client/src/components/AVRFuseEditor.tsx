import React, { useState } from 'react';
import { serialManager } from '../lib/serial';
import { CMD } from '../lib/protocol';

interface AVRFuseEditorProps {
    connected: boolean;
    isBusy: boolean;
    onBusyChange: (busy: boolean) => void;
    onLog: (message: string) => void;
}

interface FuseBits {
    low: number;
    high: number;
    extended: number;
}

const FUSE_PRESETS: Record<string, { name: string; desc: string; fuses: FuseBits }> = {
    'default': {
        name: 'Factory Default',
        desc: 'ATmega328P factory settings (8MHz internal, no bootloader)',
        fuses: { low: 0x62, high: 0xD9, extended: 0xFF }
    },
    'arduino': {
        name: 'Arduino Uno',
        desc: '16MHz external crystal, Arduino bootloader',
        fuses: { low: 0xFF, high: 0xDE, extended: 0xFD }
    },
    'internal8mhz': {
        name: '8MHz Internal',
        desc: '8MHz internal oscillator, no bootloader',
        fuses: { low: 0xE2, high: 0xD9, extended: 0xFF }
    },
    'external16mhz': {
        name: '16MHz External',
        desc: '16MHz external crystal, no bootloader',
        fuses: { low: 0xFF, high: 0xD9, extended: 0xFF }
    },
};

export const AVRFuseEditor: React.FC<AVRFuseEditorProps> = ({
    connected,
    isBusy,
    onBusyChange,
    onLog
}) => {
    const [fuses, setFuses] = useState<FuseBits>({ low: 0, high: 0, extended: 0 });
    const [editMode, setEditMode] = useState(false);

    const handleReadFuses = async () => {
        if (!connected || isBusy) return;
        onBusyChange(true);
        onLog('Reading AVR fuse bits...');

        try {
            // Enter programming mode
            await serialManager.sendCommand(CMD.ISP_ENTER);

            // Read Low Fuse (0x50, 0x00, 0x00, 0x00)
            const lowResp = await serialManager.sendCommand(CMD.ISP_XFER, new Uint8Array([0x50, 0x00, 0x00, 0x00]));
            const lowFuse = lowResp[3];

            // Read High Fuse (0x58, 0x08, 0x00, 0x00)
            const highResp = await serialManager.sendCommand(CMD.ISP_XFER, new Uint8Array([0x58, 0x08, 0x00, 0x00]));
            const highFuse = highResp[3];

            // Read Extended Fuse (0x50, 0x08, 0x00, 0x00)
            const extResp = await serialManager.sendCommand(CMD.ISP_XFER, new Uint8Array([0x50, 0x08, 0x00, 0x00]));
            const extFuse = extResp[3];

            // Exit programming mode
            await serialManager.sendCommand(CMD.ISP_EXIT);

            setFuses({ low: lowFuse, high: highFuse, extended: extFuse });
            onLog(`Fuses read: L:0x${lowFuse.toString(16).padStart(2, '0')} H:0x${highFuse.toString(16).padStart(2, '0')} E:0x${extFuse.toString(16).padStart(2, '0')}`);
        } catch (err) {
            console.error(err);
            onLog(`Fuse read failed: ${err}`);
        } finally {
            onBusyChange(false);
        }
    };

    const handleWriteFuses = async () => {
        if (!connected || isBusy) return;

        if (!window.confirm(`⚠️ WARNING: Writing incorrect fuse bits can brick your AVR!\n\nAre you sure you want to write:\nLow: 0x${fuses.low.toString(16).padStart(2, '0')}\nHigh: 0x${fuses.high.toString(16).padStart(2, '0')}\nExt: 0x${fuses.extended.toString(16).padStart(2, '0')}`)) {
            return;
        }

        onBusyChange(true);
        onLog('Writing AVR fuse bits...');

        try {
            await serialManager.sendCommand(CMD.ISP_ENTER);

            // Write Low Fuse (0xAC, 0xA0, 0x00, [data])
            await serialManager.sendCommand(CMD.ISP_XFER, new Uint8Array([0xAC, 0xA0, 0x00, fuses.low]));
            await new Promise(r => setTimeout(r, 10));

            // Write High Fuse (0xAC, 0xA8, 0x00, [data])
            await serialManager.sendCommand(CMD.ISP_XFER, new Uint8Array([0xAC, 0xA8, 0x00, fuses.high]));
            await new Promise(r => setTimeout(r, 10));

            // Write Extended Fuse (0xAC, 0xA4, 0x00, [data])
            await serialManager.sendCommand(CMD.ISP_XFER, new Uint8Array([0xAC, 0xA4, 0x00, fuses.extended]));
            await new Promise(r => setTimeout(r, 10));

            await serialManager.sendCommand(CMD.ISP_EXIT);

            onLog('Fuse bits written successfully!');
            setEditMode(false);
        } catch (err) {
            console.error(err);
            onLog(`Fuse write failed: ${err}`);
        } finally {
            onBusyChange(false);
        }
    };

    const applyPreset = (presetKey: string) => {
        const preset = FUSE_PRESETS[presetKey];
        if (preset) {
            setFuses(preset.fuses);
            onLog(`Applied preset: ${preset.name}`);
        }
    };

    {/* ... logic same ... */ }

    return (
        <div className="bg-white dark:bg-slate-900 border border-dashboard-border-light dark:border-dashboard-border-dark rounded-lg p-6 shadow-sm transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />

            <h2 className="text-sm font-bold mb-4 text-slate-600 dark:text-slate-300 flex items-center gap-2 font-mono uppercase tracking-wider">
                <span className="text-amber-500">⚡</span> Fuse Bits
            </h2>

            {/* Current Fuse Values */}
            <div className="space-y-2 mb-4 font-mono text-sm">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800 rounded">
                    <span className="text-slate-500 dark:text-slate-400">Low Fuse:</span>
                    {editMode ? (
                        <input
                            type="text"
                            value={`0x${fuses.low.toString(16).padStart(2, '0').toUpperCase()}`}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 16);
                                if (!isNaN(val) && val >= 0 && val <= 0xFF) {
                                    setFuses({ ...fuses, low: val });
                                }
                            }}
                            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 px-2 py-1 w-20 text-center rounded outline-none focus:border-cyan-500"
                        />
                    ) : (
                        <span className="text-cyan-600 dark:text-cyan-400 font-bold">0x{fuses.low.toString(16).padStart(2, '0').toUpperCase()}</span>
                    )}
                </div>

                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800 rounded">
                    <span className="text-slate-500 dark:text-slate-400">High Fuse:</span>
                    {editMode ? (
                        <input
                            type="text"
                            value={`0x${fuses.high.toString(16).padStart(2, '0').toUpperCase()}`}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 16);
                                if (!isNaN(val) && val >= 0 && val <= 0xFF) {
                                    setFuses({ ...fuses, high: val });
                                }
                            }}
                            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 px-2 py-1 w-20 text-center rounded outline-none focus:border-cyan-500"
                        />
                    ) : (
                        <span className="text-cyan-600 dark:text-cyan-400 font-bold">0x{fuses.high.toString(16).padStart(2, '0').toUpperCase()}</span>
                    )}
                </div>

                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800 rounded">
                    <span className="text-slate-500 dark:text-slate-400">Extended:</span>
                    {editMode ? (
                        <input
                            type="text"
                            value={`0x${fuses.extended.toString(16).padStart(2, '0').toUpperCase()}`}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 16);
                                if (!isNaN(val) && val >= 0 && val <= 0xFF) {
                                    setFuses({ ...fuses, extended: val });
                                }
                            }}
                            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 px-2 py-1 w-20 text-center rounded outline-none focus:border-cyan-500"
                        />
                    ) : (
                        <span className="text-cyan-600 dark:text-cyan-400 font-bold">0x{fuses.extended.toString(16).padStart(2, '0').toUpperCase()}</span>
                    )}
                </div>
            </div>

            {/* Presets */}
            <div className="mb-4">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-mono uppercase tracking-wider">Presets</label>
                <select
                    onChange={(e) => applyPreset(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 p-2 font-mono text-xs rounded outline-none focus:border-amber-500"
                    disabled={!editMode}
                >
                    <option value="">Select preset...</option>
                    {Object.entries(FUSE_PRESETS).map(([key, preset]) => (
                        <option key={key} value={key}>{preset.name} - {preset.desc}</option>
                    ))}
                </select>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={handleReadFuses}
                    disabled={!connected || isBusy}
                    className="p-2 bg-cyan-100 dark:bg-cyan-900/20 hover:bg-cyan-200 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 font-mono text-xs font-bold tracking-wider transition-all disabled:opacity-50 rounded shadow-sm"
                >
                    READ
                </button>

                {editMode ? (
                    <>
                        <button
                            onClick={handleWriteFuses}
                            disabled={!connected || isBusy}
                            className="p-2 bg-rose-100 dark:bg-rose-900/20 hover:bg-rose-200 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-mono text-xs font-bold tracking-wider transition-all disabled:opacity-50 rounded shadow-sm"
                        >
                            WRITE
                        </button>
                        <button
                            onClick={() => setEditMode(false)}
                            className="col-span-2 p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 font-mono text-xs tracking-wider transition-all rounded"
                        >
                            CANCEL
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => setEditMode(true)}
                        disabled={!connected}
                        className="p-2 bg-amber-100 dark:bg-amber-900/20 hover:bg-amber-200 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-mono text-xs font-bold tracking-wider transition-all disabled:opacity-50 rounded shadow-sm"
                    >
                        EDIT
                    </button>
                )}
            </div>

            {/* Warning */}
            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-[10px] font-mono rounded">
                ⚠️ <span className="font-bold">WARNING:</span> Incorrect fuse settings can brick your AVR. Always verify values before writing!
            </div>
        </div>
    );
};
