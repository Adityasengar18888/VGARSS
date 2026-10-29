import { useState, type FormEvent } from 'react';
import { api } from '../../services/api';
import { UserProfile } from '../../types/chat';
import { Cpu, ArrowRight, Lock, Mail, User, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void | Promise<void>;
  onDevSwitch: (username: string) => void | Promise<void>;
  onBackToLanding?: () => void;
  initialMode?: 'login' | 'register';
}

export function AuthScreen({
  onAuthenticated,
  onBackToLanding,
  initialMode = 'login',
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.v2Login({ username: username.trim(), password });
        await onAuthenticated(res.user);
      } else {
        if (!email.trim()) {
          setError('Email address is required for registration.');
          setLoading(false);
          return;
        }
        const res = await api.v2Register({
          username: username.trim(),
          email: email.trim(),
          password,
        });
        await onAuthenticated(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#080808] text-[#F2F2F2] flex flex-col justify-between items-center p-4 sm:p-6 font-sans select-none relative overflow-x-hidden">
      {/* Background Subtle Gradient & Grain */}
      <div className="absolute inset-0 bg-radial from-[#141414] via-[#080808] to-[#080808] pointer-events-none" />

      {/* Top Bar Navigation */}
      <header className="relative z-10 w-full max-w-4xl flex items-center justify-between py-2 text-xs font-mono">
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="flex items-center space-x-1.5 text-[#A1A1A1] hover:text-[#F2F2F2] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>[RETURN TO LANDING]</span>
          </button>
        )}
        <div className="flex items-center space-x-2 text-[#707070] ml-auto">
          <span>SECURITY: TLS 1.3</span>
          <span>•</span>
          <span>HASH: BCRYPT</span>
        </div>
      </header>

      {/* Central Auth Container */}
      <main className="relative z-10 w-full max-w-md my-auto">
        <div className="border border-[#292929] bg-[#111111] rounded-md shadow-2xl p-6 sm:p-8">
          {/* Brand Header */}
          <div className="mb-6 text-center">
            <div className="inline-flex w-10 h-10 rounded-[3px] bg-[#171717] border border-[#292929] items-center justify-center text-[#F2F2F2] mb-3">
              <Cpu className="w-5 h-5 text-[#E8E8E8]" />
            </div>
            <h1 className="text-xl font-bold text-[#F2F2F2] tracking-editorial">
              VGARSS <span className="font-mono text-xs font-normal text-[#707070]">// AUTH</span>
            </h1>
            <p className="text-xs text-[#707070] font-mono mt-1 uppercase tracking-technical">
              IDENTITY ACCESS MANAGEMENT
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#0A0A0A] border border-[#222222] rounded mb-6 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-center rounded-[2px] transition ${
                mode === 'login'
                  ? 'bg-[#1C1C1C] text-[#F2F2F2] font-bold border border-[#333333]'
                  : 'text-[#707070] hover:text-[#A1A1A1]'
              }`}
            >
              [01] SIGN IN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 text-center rounded-[2px] transition ${
                mode === 'register'
                  ? 'bg-[#1C1C1C] text-[#F2F2F2] font-bold border border-[#333333]'
                  : 'text-[#707070] hover:text-[#A1A1A1]'
              }`}
            >
              [02] REGISTER
            </button>
          </div>

          {/* Error Notification */}
          {error && (
            <div className="mb-5 p-3 rounded bg-[#1F1212] border border-[#4A1E1E] text-[#EF4444] text-xs font-mono flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#A1A1A1] mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#707070]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. aditya"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#171717] border border-[#292929] text-[#F2F2F2] text-xs rounded-[3px] focus:border-[#E8E8E8] transition font-mono outline-none"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#A1A1A1] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#707070]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#171717] border border-[#292929] text-[#F2F2F2] text-xs rounded-[3px] focus:border-[#E8E8E8] transition font-mono outline-none"
                    autoComplete="email"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#A1A1A1]">
                  Password
                </label>
                <span className="text-[10px] font-mono text-[#707070]">Min 6 chars</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#707070]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-[#171717] border border-[#292929] text-[#F2F2F2] text-xs rounded-[3px] focus:border-[#E8E8E8] transition font-mono outline-none"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#707070] hover:text-[#E8E8E8] transition"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-[#E8E8E8] hover:bg-white text-[#080808] font-bold text-xs uppercase tracking-wider rounded-[3px] transition flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50 shadow-sm"
            >
              <span>{loading ? 'AUTHENTICATING...' : mode === 'login' ? 'ENTER WORKSPACE' : 'INITIALIZE ACCOUNT'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </main>

      {/* Footer System Telemetry */}
      <footer className="relative z-10 w-full max-w-4xl py-2 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-[#707070] gap-2">
        <div>VGARSS 2.0 PROTOCOL // ZERO-TRUST PERSISTED SESSIONS</div>
        <div>SERVER TIME: {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC</div>
      </footer>
    </div>
  );
}
