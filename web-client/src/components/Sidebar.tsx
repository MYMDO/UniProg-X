import React from 'react';
import { CHIP_DB, ChipDef } from '../lib/chips';

interface SidebarProps {
    selectedChip: ChipDef;
    onSelectChip: (chip: ChipDef) => void;
    connected: boolean;
    isBusy: boolean;
    progress: number;
    onScanI2C: () => void;
    onScanSPI: () => void;
    onRead: () => void;
    onWrite: () => void;
    onVerify: () => void;
    onErase: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    selectedChip,
    onSelectChip,
    connected,
    isBusy,
    progress,
    onScanI2C,
    onScanSPI,
    onRead,
    onWrite,
    onVerify,
    onErase
}) => {
    return (
        <div className="lg:col-span-3 space-y-6">
            {/* Chip Selection */}
            <div className="bg-slate-900/80 border border-white/10 rounded-none p-6 backdrop-blur-md relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50" />
                <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2 font-mono uppercase tracking-wider">
                    <span className="text-cyan-400">01.</span> Target Device
                </h2>
                <select
                    className="w-full bg-black/50 border border-white/10 rounded-none p-3 text-cyan-100 focus:border-cyan-500/50 outline-none font-mono transition-colors"
                    value={selectedChip.name}
                    onChange={(e) => {
                        const chip = CHIP_DB.find(c => c.name === e.target.value)
                        if (chip) onSelectChip(chip)
                    }}
                >
                    {CHIP_DB.map(c => (
                        <option key={c.name} value={c.name} className="bg-slate-900">{c.name}</option>
                    ))}
                </select>

                <div className="mt-6 space-y-3 text-xs font-mono text-slate-400">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                        <span>TYPE</span> <span className="text-cyan-300">{selectedChip.type}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                        <span>CAPACITY</span> <span className="text-cyan-300">{selectedChip.size} BYTES</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                        <span>PAGE SIZE</span> <span className="text-cyan-300">{selectedChip.pageSize} BYTES</span>
                    </div>
                </div>
            </div>

            {/* Operations */}
            <div className="bg-slate-900/80 border border-white/10 rounded-none p-6 backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50" />
                <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2 font-mono uppercase tracking-wider">
                    <span className="text-purple-400">02.</span> Operations
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    <OperationButton
                        label="SCAN I2C"
                        color="cyan"
                        onClick={onScanI2C}
                        disabled={!connected || isBusy}
                    />
                    <OperationButton
                        label="SCAN SPI"
                        color="cyan"
                        onClick={onScanSPI}
                        disabled={!connected || isBusy}
                    />
                    <OperationButton
                        label="READ"
                        color="cyan"
                        onClick={onRead}
                        disabled={!connected || isBusy}
                    />
                    <OperationButton
                        label="WRITE"
                        color="rose"
                        onClick={onWrite}
                        disabled={!connected || isBusy}
                    />
                    <OperationButton
                        label="VERIFY"
                        color="emerald"
                        onClick={onVerify}
                        disabled={!connected || isBusy}
                    />
                    <OperationButton
                        label="ERASE"
                        color="amber"
                        onClick={onErase}
                        disabled={!connected || isBusy}
                    />
                </div>

                {/* Progress Bar */}
                {isBusy && (
                    <div className="mt-6">
                        <div className="flex justify-between text-[10px] font-mono text-cyan-400 mb-2 uppercase tracking-widest">
                            <span>Processing</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-1 bg-slate-800 w-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-200 shadow-[0_0_10px_#06b6d4]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const OperationButton = ({ label, color, onClick, disabled }: { label: string, color: string, onClick: () => void, disabled: boolean }) => {
    const colorClasses: Record<string, string> = {
        cyan: 'text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]',
        rose: 'text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]',
        emerald: 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]',
        amber: 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                p-3 border bg-black/20 font-mono text-sm font-bold tracking-wider transition-all duration-300
                disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none
                ${colorClasses[color]}
            `}
        >
            {label}
        </button>
    );
};
