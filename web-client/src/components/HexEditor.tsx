import React, { useMemo, useRef, useState, useEffect } from 'react';

interface HexEditorProps {
    data: Uint8Array;
    startAddress?: number;
}

const ROW_HEIGHT = 24; // px
const BYTES_PER_ROW = 16;

export const HexEditor: React.FC<HexEditorProps> = ({ data, startAddress = 0 }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(500);

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setContainerHeight(containerRef.current.clientHeight);
            }
        };
        // Initial measurement
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const totalRows = Math.ceil(data.length / BYTES_PER_ROW);
    const totalHeight = totalRows * ROW_HEIGHT;

    const startIndex = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleRows = Math.ceil(containerHeight / ROW_HEIGHT);
    // Render a few extra rows for smooth scrolling
    const endIndex = Math.min(totalRows, startIndex + visibleRows + 2);

    const rows = useMemo(() => {
        const result = [];
        for (let i = startIndex; i < endIndex; i++) {
            const offset = i * BYTES_PER_ROW;
            const chunk = data.slice(offset, offset + BYTES_PER_ROW);
            // Pad chunk if it's the last row and incomplete
            const bytes = Array.from(chunk);
            while (bytes.length < BYTES_PER_ROW) bytes.push(-1); // -1 as placeholder

            result.push({
                rowIndex: i,
                offset: startAddress + offset,
                bytes: bytes,
                ascii: bytes.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('')
            });
        }
        return result;
    }, [data, startAddress, startIndex, endIndex]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    return (
        <div className="bg-slate-900/80 border border-white/10 rounded-none backdrop-blur-md flex flex-col h-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500/50" />

            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-black/20">
                <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <span className="text-emerald-400">03.</span> Memory Matrix
                </h2>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    {data.length.toLocaleString()} BYTES LOADED
                </div>
            </div>

            {/* Hex Grid */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto font-mono text-sm relative custom-scrollbar"
                onScroll={handleScroll}
            >
                <div style={{ height: totalHeight, position: 'relative' }}>
                    {/* Sticky Header Row */}
                    <div className="sticky top-0 z-10 grid grid-cols-[auto_1fr_auto] gap-x-6 px-4 py-2 bg-slate-900/90 border-b border-white/10 text-slate-500 text-xs font-bold">
                        <div className="w-[8ch]">OFFSET</div>
                        <div className="flex justify-between w-[calc(16*3ch)]">
                            {Array.from({ length: 16 }).map((_, i) => (
                                <span key={i} className="w-[2ch] text-center">{i.toString(16).toUpperCase().padStart(2, '0')}</span>
                            ))}
                        </div>
                        <div className="w-[16ch] tracking-widest pl-4 border-l border-white/5">ASCII</div>
                    </div>

                    {/* Virtualized Rows */}
                    <div style={{ position: 'absolute', top: startIndex * ROW_HEIGHT + 33, left: 0, right: 0, paddingLeft: '1rem', paddingRight: '1rem' }}>
                        {rows.map((row) => (
                            <div key={row.offset} className="grid grid-cols-[auto_1fr_auto] gap-x-6 hover:bg-white/5 transition-colors h-[24px] items-center text-xs">
                                <div className="text-emerald-500/70 w-[8ch]">{row.offset.toString(16).padStart(8, '0').toUpperCase()}</div>
                                <div className="flex justify-between w-[calc(16*3ch)] text-slate-300">
                                    {row.bytes.map((byte, i) => (
                                        <span
                                            key={i}
                                            className={`w-[2ch] text-center ${byte === -1 ? 'opacity-0' : ''} ${byte === 0xFF ? 'text-slate-600' : ''} hover:text-white cursor-default`}
                                        >
                                            {byte !== -1 ? byte.toString(16).padStart(2, '0').toUpperCase() : '00'}
                                        </span>
                                    ))}
                                </div>
                                <div className="text-slate-500 tracking-widest w-[16ch] pl-4 border-l border-white/5 truncate">
                                    {row.ascii}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
