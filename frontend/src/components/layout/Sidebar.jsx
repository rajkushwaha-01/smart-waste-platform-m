import { NavLink } from 'react-router-dom';
import { AlertTriangle, LayoutDashboard, Trash2, Truck, Waves } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bins', label: 'Bins', icon: Trash2 },
  { to: '/collection', label: 'Collection', icon: Truck },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-surface-700 bg-surface-950">
      <div className="flex items-center gap-2 border-b border-surface-700 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400">
          <Waves size={18} strokeWidth={2} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-100">Smart Waste</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Ops Console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300'
                  : 'text-slate-400 hover:bg-surface-800 hover:text-slate-200'
              }`
            }
          >
            <Icon size={17} strokeWidth={1.9} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-700 p-3 text-[10px] text-slate-600">
        Smart Waste Management &copy; {new Date().getFullYear()}
      </div>
    </aside>
  );
}
