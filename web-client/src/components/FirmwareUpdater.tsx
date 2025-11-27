import React from 'react';
import { serialManager } from '../lib/serial';
import { CMD } from '../lib/protocol';

interface FirmwareUpdaterProps {
    connected: boolean;
    isBusy: boolean;
    onBusyChange: (busy: boolean) => void;
    onLog: (message: string) => void;
}

export const FirmwareUpdater: React.FC<FirmwareUpdaterProps> = ({
    connected,
    isBusy,
    onBusyChange,
    onLog
}) => {
    const [step, setStep] = React.useState<'ready' | 'updating' | 'complete'>('ready');

    const handleEnterBootloader = async () => {
        if (!connected || isBusy) return;

        if (!window.confirm('⚠️ This will reset the device into bootloader mode.\n\nYou will need to upload the new firmware manually.\n\nContinue?')) {
            return;
        }

        onBusyChange(true);
        setStep('updating');
        onLog('Entering bootloader mode...');

        try {
            await serialManager.sendCommand(CMD.BOOTLOADER);
            onLog('Device reset to bootloader mode!');
            setStep('complete');
        } catch (err) {
            console.error(err);
            onLog(`Bootloader entry failed: ${err}`);
            setStep('ready');
        } finally {
            onBusyChange(false);
        }
    };

    return (
        <div className="bg-slate-900/80 border border-white/10 rounded-none p-6 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50" />

            <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2 font-mono uppercase tracking-wider">
                <span className="text-purple-400">📦</span> Firmware Update
            </h2>

            {step === 'ready' && (
                <>
                    <div className="space-y-4 mb-6">
                        <div className="bg-black/30 p-4 border border-white/5">
                            <h3 className="text-sm font-bold text-cyan-400 mb-2 font-mono">Update Process:</h3>
                            <ol className="text-xs text-slate-300 space-y-2 font-mono list-decimal list-inside">
                                <li>Click "ENTER BOOTLOADER" below</li>
                                <li>Device will reboot as "RPI-RP2" USB drive</li>
                                <li>Download latest firmware (.uf2) from GitHub</li>
                                <li>Drag .uf2 file to the USB drive</li>
                                <li>Device will auto-reboot with new firmware</li>
                            </ol>
                        </div>

                        <div className="bg-blue-900/20 border border-blue-500/30 p-3 text-blue-300 text-xs font-mono">
                            ℹ️ <span className="font-bold">INFO:</span> Firmware version displayed in header after reconnect
                        </div>
                    </div>

                    <button
                        onClick={handleEnterBootloader}
                        disabled={!connected || isBusy}
                        className="w-full p-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 font-mono font-bold tracking-wider transition-all disabled:opacity-30"
                    >
                        ENTER BOOTLOADER
                    </button>
                </>
            )}

            {step === 'updating' && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-cyan-400 mb-4"></div>
                    <div className="text-cyan-400 font-mono text-sm">Resetting device...</div>
                </div>
            )}

            {step === 'complete' && (
                <>
                    <div className="space-y-4 mb-6">
                        <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 text-emerald-300">
                            <div className="font-bold font-mono mb-2">✅ SUCCESS</div>
                            <div className="text-xs font-mono">Device is now in bootloader mode!</div>
                        </div>

                        <div className="bg-black/30 p-4 border border-white/5">
                            <h3 className="text-sm font-bold text-cyan-400 mb-3 font-mono">Next Steps:</h3>
                            <div className="space-y-3 text-xs text-slate-300 font-mono">
                                <div>
                                    <div className="font-bold text-white mb-1">1. Download Firmware</div>
                                    <a
                                        href="https://github.com/yourusername/UniProg-X/releases/latest"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-cyan-400 hover:text-cyan-300 underline"
                                    >
                                        → Get latest .uf2 from GitHub
                                    </a>
                                </div>

                                <div>
                                    <div className="font-bold text-white mb-1">2. Install Firmware</div>
                                    <div>→ Drag .uf2 file to "RPI-RP2" USB drive</div>
                                    <div className="text-slate-500 mt-1">Device will auto-reboot after copy</div>
                                </div>

                                <div>
                                    <div className="font-bold text-white mb-1">3. Reconnect</div>
                                    <div>→ Click "INITIALIZE LINK" to reconnect</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setStep('ready')}
                        className="w-full p-2 bg-slate-700/20 hover:bg-slate-700/30 text-slate-400 border border-slate-500/30 font-mono text-sm tracking-wider transition-all"
                    >
                        RESET
                    </button>
                </>
            )}
        </div>
    );
};
