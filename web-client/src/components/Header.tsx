import React from 'react';

interface HeaderProps {
    connected: boolean;
    onConnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({ connected, onConnect }) => {
    return (
        <header className="mb-8 flex justify-between items-center border-b border-white/10 pb-6">
            <div>
                <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                    UniProg-X
                </h1>
                <p className="text-slate-400 mt-2 font-mono text-sm tracking-widest uppercase">
                    Universal Hardware Programmer // <span className="text-cyan-400">v2.0</span>
                </p>
            </div>
            <div className="flex gap-6 items-center">
                <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-white/5">
                    <div className={`h-3 w-3 rounded-full transition-all duration-500 ${connected ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-rose-500 shadow-[0_0_15px_#f43f5e]'} `} />
                    <span className={`font-mono text-sm ${connected ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {connected ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
                    </span>
                </div>
                <button
                    className={`px-8 py-3 rounded-none skew-x-[-10deg] font-bold tracking-wider transition-all duration-300 border ${connected
                        ? 'bg-slate-900/50 hover:bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]'
                        } `}
                    onClick={onConnect}
                >
                    <span className="skew-x-[10deg] inline-block">
                        {connected ? 'TERMINATE LINK' : 'INITIALIZE LINK'}
                    </span>
                </button>
            </div>
        </header>
    );
};
