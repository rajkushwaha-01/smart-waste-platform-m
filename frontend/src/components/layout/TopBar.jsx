import { useEffect, useState } from 'react';

export function TopBar({ title, subtitle }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-surface-700 bg-surface-950/80 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          LIVE
        </div>
        <span className="font-mono text-xs text-slate-500">
          {now.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}{' '}
          {now.toLocaleTimeString(undefined, { hour12: false })}
        </span>
      </div>
    </header>
  );
}
