import { useState } from 'react';
import { Save, Key, UserCheck, Trash2, CheckCircle2 } from 'lucide-react';
import { Card } from '../components/common/Card';
import { User } from '../types/auth';
import { api } from '../services/api';

interface SettingsViewProps {
  currentUser: User | null;
  onRefreshAuth: () => void;
}

export function SettingsView({ currentUser, onRefreshAuth }: SettingsViewProps) {
  const [apiUrl, setApiUrl] = useState<string>(
    localStorage.getItem('vgarss_api_url') || 'http://127.0.0.1:8000'
  );
  const [wsUrl, setWsUrl] = useState<string>(
    localStorage.getItem('vgarss_ws_url') || 'ws://127.0.0.1:8000'
  );
  const [tcpPort, setTcpPort] = useState<number>(9000);

  const [usernameInput, setUsernameInput] = useState<string>('alice_dev');
  const [passwordInput, setPasswordInput] = useState<string>('SecurePassword123!');
  const [authSuccess, setAuthSuccess] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSaveEndpoints = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('vgarss_api_url', apiUrl.trim());
    localStorage.setItem('vgarss_ws_url', wsUrl.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      await api.login({
        username: usernameInput.trim(),
        password: passwordInput,
      });
      setAuthSuccess(true);
      onRefreshAuth();
      setTimeout(() => setAuthSuccess(false), 3000);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed.');
    }
  };

  const handleClearCache = () => {
    if (confirm('Clear local VGARSS token, storage settings, and cache?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">System Configuration & Network Settings</h2>
        <p className="text-xs text-slate-400 mt-1">
          Endpoint routing, loopback network security, developer session management, and telemetry parameters.
        </p>
      </div>

      {/* Network Configuration */}
      <Card
        title="Network Gateway Endpoints"
        subtitle="Configure backend REST and WebSocket listener endpoints (Bound to private loopback 127.0.0.1)"
      >
        <form onSubmit={handleSaveEndpoints} className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                FastAPI REST Base URL
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                WebSocket Host URI
              </label>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Raw TCP Socket Server Port
            </label>
            <input
              type="number"
              value={tcpPort}
              onChange={(e) => setTcpPort(Number(e.target.value))}
              className="w-48 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Port 9000 demonstrates 4-byte length-prefixed binary packet framing.
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {saveSuccess ? (
              <span className="text-emerald-400 flex items-center space-x-1 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Endpoints saved successfully</span>
              </span>
            ) : (
              <span className="text-slate-500 text-[11px]">
                Requires page reload if host addresses are changed.
              </span>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Endpoints</span>
            </button>
          </div>
        </form>
      </Card>

      {/* User Session & Authentication */}
      <Card
        title="Developer Identity & Session Authentication"
        subtitle="Manage Bearer token authorization and user profile"
      >
        <div className="space-y-4 text-xs font-mono">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white font-sans">
                  {currentUser ? currentUser.username : 'alice_dev'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {currentUser ? currentUser.email : 'alice@vgarss.org'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                AUTHENTICATED
              </span>
              <p className="text-[10px] text-slate-500 mt-1">24h Session Token Active</p>
            </div>
          </div>

          {/* Quick Login Form */}
          <form onSubmit={handleLogin} className="pt-3 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 font-sans">Switch Account / Re-authenticate</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {authError && <p className="text-xs text-rose-400">{authError}</p>}
            {authSuccess && <p className="text-xs text-emerald-400">Successfully re-authenticated!</p>}

            <button
              type="submit"
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Login with Account</span>
            </button>
          </form>
        </div>
      </Card>

      {/* Storage and Cache Reset */}
      <Card title="Cache & Storage Maintenance" subtitle="Clear cached tokens and local preferences">
        <div className="flex items-center justify-between text-xs">
          <div>
            <p className="text-slate-300 font-semibold">Purge Local Storage Cache</p>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Clears local session tokens, custom port settings, and reset view state.
            </p>
          </div>
          <button
            onClick={handleClearCache}
            className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cache</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
