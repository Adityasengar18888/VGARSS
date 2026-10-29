import { useState, type FormEvent } from 'react';
import { api } from '../../services/api';
import { UserProfile } from '../../types/chat';
import { Cpu, ArrowRight, Shield, User, Lock, Mail, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void | Promise<void>;
  onDevSwitch: (username: string) => void | Promise<void>;
}

export function AuthScreen({ onAuthenticated, onDevSwitch }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#F5F6F8] flex flex-col justify-center items-center p-4 select-none">
      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-xl bg-[#4055A8] flex items-center justify-center text-white shadow-sm mb-3">
          <Cpu className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[#202631] tracking-tight">VGARSS 2.0</h1>
        <p className="text-xs text-[#667085] mt-1 max-w-[40ch]">
          Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling
        </p>
      </div>

      {/* Main Auth Card */}
      <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-xl shadow-sm p-6">
        {/* Mode Tabs */}
        <div className="flex border-b border-[#E4E7EC] mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
              mode === 'login'
                ? 'border-[#4055A8] text-[#4055A8]'
                : 'border-transparent text-[#667085] hover:text-[#202631]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
              mode === 'register'
                ? 'border-[#4055A8] text-[#4055A8]'
                : 'border-transparent text-[#667085] hover:text-[#202631]'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#344054] font-medium mb-1">
              {mode === 'login' ? 'Username or Email' : 'Username'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#98A2B3]">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'login' ? 'e.g. alice or alice@vgarss.org' : 'e.g. j_doe'}
                required
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none transition"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-[#344054] font-medium mb-1">Work Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#98A2B3]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.org"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[#344054] font-medium mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#98A2B3]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full mt-2 py-2.5 px-4 bg-[#4055A8] hover:bg-[#334488] disabled:bg-[#D0D5DD] text-white font-semibold rounded-lg flex items-center justify-center space-x-2 transition active:scale-[0.98]"
          >
            <span>{loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Developer Sandbox Fast-Switch Row */}
        <div className="mt-6 pt-5 border-t border-[#F2F4F7]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#475467] flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-[#4055A8]" />
              <span>Developer Quick Testing</span>
            </span>
            <span className="text-[10px] text-[#98A2B3] font-mono">dev mode</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { uname: 'alice', label: 'Alice (Owner)', role: 'Lead' },
              { uname: 'bob', label: 'Bob (Admin)', role: 'Systems' },
              { uname: 'charlie', label: 'Charlie (Member)', role: 'Kernel' },
            ].map(({ uname, role }) => (
              <button
                key={uname}
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError(null);
                  setLoading(true);
                  try {
                    await onDevSwitch(uname);
                  } catch (err: any) {
                    setError(err.message || 'Quick login failed.');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="py-1.5 px-2 bg-[#F8FAFC] hover:bg-[#EEF2FF] border border-[#E4E7EC] hover:border-[#CBD5E1] rounded-md text-left transition active:scale-[0.97] disabled:opacity-50"
              >
                <div className="font-semibold text-[#202631] capitalize text-[11px] truncate">{uname}</div>
                <div className="text-[9px] text-[#667085]">{role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Security Footer Notice */}
      <div className="mt-4 text-center text-[11px] text-[#98A2B3]">
        End-to-End Authenticated Session • 12-Round Bcrypt Hashing • HttpOnly Cookies
      </div>
    </div>
  );
}
