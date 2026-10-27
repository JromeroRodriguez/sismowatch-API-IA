import React from 'react';
import { Activity, ShieldCheck, Eye, LogOut, RefreshCw, Zap } from 'lucide-react';
import { UserSession } from '../types';

interface HeaderProps {
  session: UserSession;
  onLogout: () => void;
  sseConnected: boolean;
  lastUpdated: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  activeTab: 'dashboard' | 'events' | 'pipeline' | 'ai-reports';
  setActiveTab: (tab: 'dashboard' | 'events' | 'pipeline' | 'ai-reports') => void;
  onOpenBackfill?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  onLogout,
  sseConnected,
  lastUpdated,
  onRefresh,
  isRefreshing,
  activeTab,
  setActiveTab,
  onOpenBackfill,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand + Navigation */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Activity className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-rose-300 to-slate-100 bg-clip-text text-transparent">
                SismoWatch
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-slate-850 text-amber-400 border border-slate-700">
                Gold v1.0
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'events'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              Eventos & Exportación
            </button>
            <button
              onClick={() => setActiveTab('ai-reports')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'ai-reports'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              IA & Anomalías
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'pipeline'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              Pipeline & Calidad
            </button>
          </nav>
        </div>

        {/* Right: Live SSE indicator, Actions, Role & Logout */}
        <div className="flex items-center space-x-3">
          
          {/* SSE Live Status Indicator */}
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-850 border border-slate-800 text-xs font-medium">
            <span className="relative flex h-2.5 w-2.5">
              {sseConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              )}
            </span>
            <span className={sseConnected ? 'text-emerald-400 text-xs font-mono font-semibold' : 'text-amber-400 text-xs font-mono'}>
              {sseConnected ? 'EN VIVO' : 'CONECTANDO...'}
            </span>
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Actualizar datos ahora"
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Admin Backfill Button (STRICTLY HIDDEN FOR VIEWER) */}
          {session.role === 'admin' && onOpenBackfill && (
            <button
              onClick={onOpenBackfill}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow-md shadow-amber-500/10"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Backfill Airflow</span>
            </button>
          )}

          {/* User Badge */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-medium text-slate-200">{session.username}</div>
              <div className="text-[10px] uppercase font-mono tracking-wider font-semibold">
                {session.role === 'admin' ? (
                  <span className="text-rose-400 flex items-center justify-end space-x-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>ADMIN</span>
                  </span>
                ) : (
                  <span className="text-sky-400 flex items-center justify-end space-x-1">
                    <Eye className="w-2.5 h-2.5" />
                    <span>VIEWER</span>
                  </span>
                )}
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              title="Cerrar sesión"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </header>
  );
};
