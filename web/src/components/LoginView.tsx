import React, { useState } from 'react';
import { Activity, ShieldCheck, Eye, Lock, User, AlertCircle } from 'lucide-react';
import { loginUser } from '../api';
import { UserSession } from '../types';

interface LoginViewProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (u: string, p: string) => {
    setLoading(true);
    setError(null);
    try {
      const session = await loginUser(u, p);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor ingresa usuario y contraseña');
      return;
    }
    handleLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      
      {/* Background radial glow */}
      <div className="absolute w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -top-20" />

      <div className="w-full max-w-md glass-panel border border-white/10 rounded-3xl p-7 sm:p-9 shadow-2xl relative z-10">
        
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-glow-amber mb-3.5">
            <Activity className="w-9 h-9 text-slate-950 font-bold" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans">SismoWatch</h1>
          <p className="text-xs text-slate-350 mt-1 font-medium">
            Plataforma Oficial de Monitoreo Sísmico & Calidad Medallion
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5 shadow-sm" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-username" className="block text-xs font-semibold text-slate-200 mb-1.5">
              Usuario
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin o viewer"
                autoComplete="username"
                className="w-full pl-10 pr-3 py-2.5 min-h-[42px] bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 transition font-medium"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-200 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin123"
                autoComplete="current-password"
                className="w-full pl-10 pr-3 py-2.5 min-h-[42px] bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 transition font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wider uppercase transition shadow-glow-amber disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {loading ? 'Verificando credenciales...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Quick Presets Divider */}
        <div className="mt-7 pt-5 border-t border-white/10">
          <div className="text-[11px] text-slate-400 text-center uppercase tracking-wider font-semibold mb-3 font-mono">
            Acceso Rápido para Demostración
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleLogin('admin', 'admin123')}
              disabled={loading}
              className="flex items-center justify-center space-x-2 py-2.5 px-3 min-h-[42px] rounded-xl bg-slate-850 hover:bg-slate-800 border border-rose-500/30 text-rose-300 text-xs font-semibold transition hover:border-rose-400 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <span>Rol ADMIN</span>
            </button>

            <button
              type="button"
              onClick={() => handleLogin('viewer', 'admin123')}
              disabled={loading}
              className="flex items-center justify-center space-x-2 py-2.5 px-3 min-h-[42px] rounded-xl bg-slate-850 hover:bg-slate-800 border border-sky-500/30 text-sky-300 text-xs font-semibold transition hover:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50"
            >
              <Eye className="w-4 h-4 text-sky-400" />
              <span>Rol VIEWER</span>
            </button>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center text-xs text-slate-400 font-mono">
          Autenticación JWT &bull; Capa Gold &bull; PostgreSQL 16
        </div>

      </div>
    </div>
  );
};
