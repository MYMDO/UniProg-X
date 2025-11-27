import React, { useEffect, useRef } from 'react';

interface LogProps {
    logs: string[];
}

export const Log: React.FC<LogProps> = ({ logs }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="bg-slate-900/80 border border-white/10 rounded-none p-6 backdrop-blur-md flex flex-col h-64 relative overflow-hidden lg:col-span-3">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-500/50" />
            <h2 className="text-lg font-bold mb-4 text-white font-mono uppercase tracking-wider flex justify-between items-center">
                <span>System Log</span>
                <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse delay-75" />
                    <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse delay-150" />
                </div>
            </h2>
            <div className="flex-1 bg-black/60 border border-white/5 p-3 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1 shadow-inner">
                {logs.map((l, i) => (
                    <div key={i} className="border-l-2 border-slate-700 pl-2 hover:bg-white/5 hover:text-slate-200 transition-colors">
                        <span className="text-slate-600 mr-2">[{i.toString().padStart(3, '0')}]</span>
                        {l}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
