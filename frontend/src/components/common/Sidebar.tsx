import {
  LayoutDashboard,
  Users,
  Cpu,
  Lock,
  Network,
  AlertTriangle,
  BarChart3,
  Settings,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { User } from '../../types/auth';

export type ViewType =
  | 'overview'
  | 'groups'
  | 'scheduler'
  | 'resources'
  | 'network'
  | 'deadlock'
  | 'analytics'
  | 'settings';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  currentUser: User | null;
  role?: string;
}

const NAV_ITEMS: { id: ViewType; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'groups', label: 'Virtual Groups', icon: Users },
  { id: 'scheduler', label: 'Process Scheduler', icon: Cpu },
  { id: 'resources', label: 'Resource Monitor', icon: Lock },
  { id: 'network', label: 'Network & TCP', icon: Network },
  { id: 'deadlock', label: 'Deadlock Lab', icon: AlertTriangle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentView, onNavigate, currentUser, role }: SidebarProps) {
  return (
    <aside className="w-60 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0">
      <div className="py-4">
        <div className="px-4 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
          System Domains
        </div>
        <nav className="space-y-1 px-3" aria-label="System Domains Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ${
                  isActive
                    ? 'bg-slate-900 text-sky-400 border border-slate-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="text-[10px] font-mono text-sky-400 font-bold uppercase">[ACTIVE]</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Trust & Session Footer */}
      <div className="p-3 m-3 space-y-3 border-t border-slate-800 bg-slate-900 rounded-lg">
        {/* User Session */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {currentUser ? currentUser.username : 'alice_dev'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              ROLE: {role || 'OWNER'}
            </p>
          </div>
        </div>

        {/* Legal & Trust Metadata */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>MIT License</span>
          <a
            href="https://github.com/vgarss/vgarss"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 text-slate-400 hover:text-sky-300 underline"
          >
            <span>v2.0 Docs</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </aside>
  );
}
