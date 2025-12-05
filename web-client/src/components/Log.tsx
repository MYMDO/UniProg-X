import React, { useEffect, useRef } from 'react';

interface LogProps {
    logs: string[];
}

export const Log: React.FC<LogProps> = ({ logs }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const saveLog = () => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const filename = `uniprog-log-${timestamp}.txt`;
        const logContent = logs.map((entry, index) => `[${index.toString().padStart(3, '0')}] ${entry}`).join('\n');

        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-dashboard-border-light dark:border-dashboard-border-dark rounded-lg flex flex-col h-full shadow-sm transition-colors">
            <div className="flex justify-between items-center p-3 border-b border-dashboard-border-light dark:border-dashboard-border-dark bg-slate-50 dark:bg-slate-800/50 rounded-t-lg">
                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
                    System Console
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={saveLog}
                        disabled={logs.length === 0}
                        className="text-[10px] font-mono bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                        SAVE LOG
                    </button>
                </div>
            </div>

            <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] space-y-1 bg-white dark:bg-slate-950 rounded-b-lg">
                {logs.length === 0 && (
                    <div className="text-slate-300 dark:text-slate-700 italic text-center mt-4">System Initialized. Ready for operations.</div>
                )}
                {logs.map((l, i) => (
                    <div key={i} className="flex gap-2 hover:bg-slate-50 dark:hover:bg-slate-900 px-1 rounded transition-colors">
                        <span className="text-slate-400 dark:text-slate-600 select-none">[{i.toString().padStart(3, '0')}]</span>
                        <span className={`
                            ${l.includes('Error') || l.includes('Failed') ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}
                            ${l.includes('Success') || l.includes('Complete') ? 'text-emerald-600 dark:text-emerald-400' : ''}
                            ${!l.includes('Error') && !l.includes('Success') ? 'text-slate-600 dark:text-slate-300' : ''}
                        `}>
                            {l}
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
