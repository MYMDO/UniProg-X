import React from 'react';

interface HeaderProps {
    connected: boolean;
    onConnect: () => void;
    currentTheme: 'light' | 'dark';
    onThemeToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ connected, onConnect, currentTheme, onThemeToggle }) => {
    return (
        <header className="flex justify-between items-center h-16 px-6 bg-dashboard-panel-light dark:bg-dashboard-panel-dark border-b border-dashboard-border-light dark:border-dashboard-border-dark transition-colors duration-300">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
                        UniProg-X
                    </h1>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-widest uppercase">
                        v2.0 // DASHBOARD
                    </span>
                </div>

                {/* Connection Badge */}
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono font-bold border transition-all ${connected
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    {connected ? 'ONLINE' : 'OFFLINE'}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={onThemeToggle}
                    className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                    title={`Switch to ${currentTheme === 'light' ? 'Dark' : 'Light'} Mode`}
                >
                    {currentTheme === 'light' ? '🌙' : '☀️'}
                </button>

                <button
                    onClick={onConnect}
                    className={`px-4 py-1.5 text-xs font-bold font-mono tracking-wider rounded transition-all border ${connected
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-white border-cyan-500 shadow-lg shadow-cyan-500/20'
                        }`}
                >
                    {connected ? 'DISCONNECT' : 'CONNECT SYSTEM'}
                </button>
            </div>
        </header>
    );
};
