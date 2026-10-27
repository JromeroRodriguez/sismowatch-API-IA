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

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3">
            <Activity className="w-8 h-8 text-slate-950 font-bold" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SismoWatch</h1>
          <p className="text-xs text-slate-400 mt-1">
            Plataforma Oficial de Monitoreo Sísmico & Calidad Medallion
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Usuario</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin o viewer"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin123"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wider uppercase transition shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Quick Presets Divider */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="text-[11px] text-slate-400 text-center uppercase tracking-wider font-semibold mb-3">
            Acceso Rápido para Demostración
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleLogin('admin', 'admin123')}
              disabled={loading}
              className="flex items-center justify-center space-x-1.5 p-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-rose-500/30 text-rose-300 text-xs font-medium transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
              <span>Rol ADMIN</span>
            </button>

            <button
              type="button"
              onClick={() => handleLogin('viewer', 'admin123')}
              disabled={loading}
              className="flex items-center justify-center space-x-1.5 p-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-sky-500/30 text-sky-300 text-xs font-medium transition"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>Rol VIEWER</span>
            </button>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center text-[10px] text-slate-500 font-mono">
          Autenticación JWT &bull; Capa Gold &bull; PostgreSQL 16
        </div>

      </div>
    </div>
  );
};
