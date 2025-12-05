import React from 'react';
import { CHIP_DB, ChipDef } from '../lib/chips';

interface SidebarProps {
    mode: 'I2C' | 'SPI' | 'AVR' | 'STM32';
    setMode: (mode: 'I2C' | 'SPI' | 'AVR' | 'STM32') => void;
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
    onLoad: () => void;
    onSave: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    mode,
    setMode,
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
    onErase,
    onLoad,
    onSave
}) => {
    // Filter chips based on mode
    const filteredChips = CHIP_DB.filter(c => {
        if (mode === 'I2C') return c.type === 'I2C';
        if (mode === 'SPI') return c.type === 'SPI';
        if (mode === 'AVR') return c.type === 'AVR';
        if (mode === 'STM32') return c.type === 'STM32';
        return false;
    });

    return (
        <div className="w-80 h-full flex flex-col gap-4 bg-dashboard-panel-light dark:bg-dashboard-panel-dark border-r border-dashboard-border-light dark:border-dashboard-border-dark p-4 overflow-y-auto transition-colors duration-300">
            {/* Mode Switcher (Moved from App.tsx) */}
            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-1 flex gap-1 border border-dashboard-border-light dark:border-dashboard-border-dark">
                {(['I2C', 'SPI', 'AVR', 'STM32'] as const).map((m) => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`
                            flex-1 py-1.5 text-[10px] font-bold font-mono tracking-wider rounded transition-all
                            ${mode === m
                                ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }
                        `}
                    >
                        {m}
                    </button>
                ))}
            </div>

            {/* Target Device Card */}
            <div className="bg-white dark:bg-slate-900 border border-dashboard-border-light dark:border-dashboard-border-dark rounded-lg p-4 shadow-sm transition-colors">
                <h2 className="text-xs font-bold mb-3 text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    Target
                </h2>
                <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-cyan-500 transition-colors cursor-pointer"
                    value={selectedChip.name}
                    onChange={(e) => {
                        const chip = CHIP_DB.find(c => c.name === e.target.value)
                        if (chip) onSelectChip(chip)
                    }}
                >
                    {filteredChips.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                </select>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                        <div className="text-slate-400 mb-1">CAPACITY</div>
                        <div className="text-cyan-600 dark:text-cyan-400 font-bold">{selectedChip.size} B</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                        <div className="text-slate-400 mb-1">PAGE</div>
                        <div className="text-cyan-600 dark:text-cyan-400 font-bold">{selectedChip.pageSize} B</div>
                    </div>
                </div>
            </div>

            {/* Operations Card */}
            <div className="bg-white dark:bg-slate-900 border border-dashboard-border-light dark:border-dashboard-border-dark rounded-lg p-4 shadow-sm flex-1 transition-colors">
                <h2 className="text-xs font-bold mb-3 text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Actions
                </h2>

                <div className="space-y-2">
                    {mode === 'I2C' && (
                        <OperationButton
                            label="Scan I2C Bus"
                            icon="🔍"
                            onClick={onScanI2C}
                            disabled={!connected || isBusy}
                            variant="secondary"
                        />
                    )}
                    {mode === 'SPI' && (
                        <OperationButton
                            label="Scan SPI Bus"
                            icon="🔍"
                            onClick={onScanSPI}
                            disabled={!connected || isBusy}
                            variant="secondary"
                        />
                    )}

                    <div className="h-2" />

                    <div className="grid grid-cols-2 gap-2">
                        <OperationButton label="Read" icon="📥" onClick={onRead} disabled={!connected || isBusy} variant="primary" />
                        <OperationButton label="Write" icon="📤" onClick={onWrite} disabled={!connected || isBusy} variant="danger" />
                    </div>

                    <OperationButton label="Verify Content" icon="✓" onClick={onVerify} disabled={!connected || isBusy} variant="secondary" />

                    {mode !== 'STM32' && (
                        <OperationButton label="Erase Chip" icon="🗑" onClick={onErase} disabled={!connected || isBusy} variant="warning" />
                    )}

                    <div className="h-2" />
                    <div className="border-t border-slate-200 dark:border-slate-800 my-2" />

                    <div className="grid grid-cols-2 gap-2">
                        <OperationButton label="Load File" icon="📂" onClick={onLoad} disabled={isBusy} variant="secondary" />
                        <OperationButton label="Save File" icon="💾" onClick={onSave} disabled={isBusy} variant="secondary" />
                    </div>
                </div>

                {/* Progress Indicator */}
                {isBusy && (
                    <div className="mt-6 p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between text-[10px] font-mono text-cyan-600 dark:text-cyan-400 mb-2 uppercase tracking-widest font-bold">
                            <span>Processing...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-cyan-500 transition-all duration-200 rounded-full"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface OperationBtnProps {
    label: string;
    icon?: string;
    onClick: () => void;
    disabled: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'warning';
}

const OperationButton: React.FC<OperationBtnProps> = ({ label, icon, onClick, disabled, variant = 'primary' }) => {
    const variants = {
        primary: 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/20',
        secondary: 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20',
        warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 hover:bg-amber-200 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                w-full px-4 py-2.5 rounded text-xs font-bold tracking-wide transition-all duration-200
                flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                ${variants[variant]}
                ${variant === 'primary' || variant === 'danger' ? 'shadow-lg' : ''}
            `}
        >
            {icon && <span className="text-base">{icon}</span>}
            {label}
        </button>
    );
};
