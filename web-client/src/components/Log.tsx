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
        // Generate filename with timestamp
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const timestamp = `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
        const filename = `uniprog-log-${timestamp}.txt`;

        // Format log entries
        const logContent = logs
            .map((entry, index) => `[${index.toString().padStart(3, '0')}] ${entry}`)
            .join('\n');

        // Create blob with proper MIME type
        const blob = new Blob([logContent], {
            type: 'application/octet-stream' // Force download
        });

        // Create object URL
        const url = URL.createObjectURL(blob);

        // Create link element
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.position = 'absolute';
        link.style.left = '-9999px';

        // Add to document and trigger with mouse event
        document.body.appendChild(link);

        // Create and dispatch mouse event
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        link.dispatchEvent(event);

        // Cleanup after short delay
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    };

    return (
        <div className="bg-slate-900/80 border border-white/10 rounded-none p-6 backdrop-blur-md flex flex-col h-64 relative overflow-hidden lg:col-span-3">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-500/50" />
            <h2 className="text-lg font-bold mb-4 text-white font-mono uppercase tracking-wider flex justify-between items-center">
                <span>System Log</span>
                <div className="flex gap-2 items-center">
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse" />
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse delay-75" />
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse delay-150" />
                    </div>
                    <button
                        onClick={saveLog}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                        title="Save log to file"
                        disabled={logs.length === 0}
                    >
                        💾 Save
                    </button>
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
