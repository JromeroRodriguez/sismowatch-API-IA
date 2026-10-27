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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xs relative z-10">
        
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-xs mb-3 text-white">
            <Activity className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">SismoWatch</h1>
          <p className="text-xs text-slate-500 mt-1">
            Plataforma Profesional de Monitoreo Sísmico & Calidad Medallion
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                className="w-full pl-10 pr-3 py-2.5 min-h-[42px] bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition font-medium"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                className="w-full pl-10 pr-3 py-2.5 min-h-[42px] bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 min-h-[42px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs tracking-wide transition shadow-xs disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {loading ? 'Verificando credenciales...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Quick Presets Divider */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="text-[11px] text-slate-400 text-center uppercase tracking-wider font-semibold mb-3 font-mono">
            Acceso Rápido para Demostración
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleLogin('admin', 'admin123')}
              disabled={loading}
              className="flex items-center justify-center space-x-2 py-2 px-3 min-h-[38px] rounded-lg bg-purple-50 hover:bg-purple-100/70 border border-purple-200 text-purple-700 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Rol ADMIN</span>
            </button>

            <button
              type="button"
              onClick={() => handleLogin('viewer', 'admin123')}
              disabled={loading}
              className="flex items-center justify-center space-x-2 py-2 px-3 min-h-[38px] rounded-lg bg-blue-50 hover:bg-blue-100/70 border border-blue-200 text-blue-700 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
            >
              <Eye className="w-4 h-4 text-blue-600" />
              <span>Rol VIEWER</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
