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
  activeTab: 'dashboard' | 'events' | 'pipeline';
  setActiveTab: (tab: 'dashboard' | 'events' | 'pipeline') => void;
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
    <header className="sticky top-0 z-40 glass-panel border-b border-white/10 text-slate-100 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand + Navigation */}
        <div className="flex items-center space-x-6">
          <button
            type="button"
            className="flex items-center space-x-3 text-left focus-visible:ring-2 focus-visible:ring-amber-500 rounded-xl"
            onClick={() => setActiveTab('dashboard')}
            aria-label="Ir al Dashboard de SismoWatch"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Activity className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-rose-300 to-slate-100 bg-clip-text text-transparent">
                SismoWatch
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-850/80 text-amber-400 border border-amber-500/20">
                Gold v1.0
              </span>
            </div>
          </button>

          {/* Navigation Tabs */}
          <nav aria-label="Navegación principal" className="hidden md:flex space-x-1.5 bg-slate-950/60 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-slate-350 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'events'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-slate-350 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Eventos & Exportación
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'pipeline'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-slate-350 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Pipeline & Calidad
            </button>
          </nav>
        </div>

        {/* Right: Live SSE indicator, Actions, Role & Logout */}
        <div className="flex items-center space-x-3">
          
          {/* SSE Live Status Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-white/10 text-xs font-medium shadow-inner">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              {sseConnected ? (
                <>
                  <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              )}
            </span>
            <span className={sseConnected ? 'text-emerald-400 text-xs font-mono font-bold tracking-wider' : 'text-amber-400 text-xs font-mono tracking-wider'}>
              {sseConnected ? 'EN VIVO' : 'CONECTANDO...'}
            </span>
            {lastUpdated && (
              <span className="hidden lg:inline text-[10px] text-slate-400 font-mono border-l border-slate-700 pl-2">
                {lastUpdated}
              </span>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Actualizar datos de sismología ahora"
            className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-850 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Admin Backfill Button (STRICTLY HIDDEN FOR VIEWER) */}
          {session.role === 'admin' && onOpenBackfill && (
            <button
              onClick={onOpenBackfill}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-500/20 focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Backfill Airflow</span>
            </button>
          )}

          {/* User Badge */}
          <div className="flex items-center space-x-2 pl-3 border-l border-white/10">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-slate-100">{session.username}</div>
              <div className="text-[10px] uppercase font-mono tracking-wider font-bold">
                {session.role === 'admin' ? (
                  <span className="text-rose-400 flex items-center justify-end space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>ADMIN</span>
                  </span>
                ) : (
                  <span className="text-sky-400 flex items-center justify-end space-x-1">
                    <Eye className="w-3 h-3" />
                    <span>VIEWER</span>
                  </span>
                )}
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              aria-label="Cerrar sesión de SismoWatch"
              className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Mobile Tab Sub-bar */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 space-x-2 border-t border-white/5 bg-slate-950/80">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
            activeTab === 'dashboard' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
            activeTab === 'events' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400'
          }`}
        >
          Eventos
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
            activeTab === 'pipeline' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400'
          }`}
        >
          Pipeline
        </button>
      </div>
    </header>
  );
};
