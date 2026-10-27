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
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-900 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand + Navigation */}
        <div className="flex items-center space-x-6">
          <button
            type="button"
            className="flex items-center space-x-3 text-left rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 transition"
            onClick={() => setActiveTab('dashboard')}
            aria-label="Ir al Dashboard de SismoWatch"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-slate-900 font-sans">
                SismoWatch
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Gold v1.0
              </span>
            </div>
          </button>

          {/* Navigation Tabs (SaaS Minimalist Pill style) */}
          <nav aria-label="Navegación principal" className="hidden md:flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'events'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Eventos & Exportación
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'pipeline'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Pipeline & Calidad
            </button>
          </nav>
        </div>

        {/* Right: Live SSE indicator, Actions, Role & Logout */}
        <div className="flex items-center space-x-3">
          
          {/* SSE Live Status Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors bg-slate-50 border-slate-200">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {sseConnected ? (
                <>
                  <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              )}
            </span>
            <span className={sseConnected ? 'text-emerald-700 text-xs font-mono font-semibold' : 'text-amber-700 text-xs font-mono font-semibold'}>
              {sseConnected ? 'EN VIVO' : 'CONECTANDO...'}
            </span>
            {lastUpdated && (
              <span className="hidden lg:inline text-[11px] text-slate-500 font-mono border-l border-slate-200 pl-2">
                {lastUpdated}
              </span>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Actualizar datos de sismología ahora"
            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Admin Backfill Button (STRICTLY HIDDEN FOR VIEWER) */}
          {session.role === 'admin' && onOpenBackfill && (
            <button
              onClick={onOpenBackfill}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Backfill Airflow</span>
            </button>
          )}

          {/* User Badge */}
          <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-200">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-slate-900">{session.username}</div>
              <div className="text-[10px] uppercase font-mono tracking-wider font-semibold">
                {session.role === 'admin' ? (
                  <span className="text-purple-600 flex items-center justify-end space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>ADMIN</span>
                  </span>
                ) : (
                  <span className="text-blue-600 flex items-center justify-end space-x-1">
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
              className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Mobile Tab Sub-bar */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 space-x-2 border-t border-slate-200 bg-white">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
            activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
            activeTab === 'events' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Eventos
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
            activeTab === 'pipeline' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Pipeline
        </button>
      </div>
    </header>
  );
};
