import React from 'react';
import { Activity, Flame, Waves, CheckCircle2, Clock } from 'lucide-react';
import { KPIsResponse } from '../types';

interface KpiCardsProps {
  kpis: KPIsResponse | null;
  loading: boolean;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis, loading }) => {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-900 border border-slate-800 p-4 animate-pulse flex flex-col justify-between"
          >
            <div className="h-4 bg-slate-800 rounded w-1/2"></div>
            <div className="h-8 bg-slate-800 rounded w-3/4"></div>
            <div className="h-3 bg-slate-800 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const freshnessText =
    kpis.data_freshness_minutes !== null
      ? `${kpis.data_freshness_minutes.toFixed(0)} min atrás`
      : 'En sincronía';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      
      {/* 1. Sismos 24h */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-4 hover:border-slate-700 transition group shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Sismos (24h)</span>
          <Activity className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-white tracking-tight">
            {kpis.total_events_24h}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            / {kpis.total_events_gold} total Gold
          </span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-400 flex items-center space-x-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Feed USGS cada 5m</span>
        </div>
      </div>

      {/* 2. Magnitud Máxima */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-4 hover:border-slate-700 transition group shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Mag. Máxima (24h)</span>
          <Flame className="w-4 h-4 text-rose-500" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className={`text-3xl font-extrabold tracking-tight ${
            (kpis.max_magnitude_24h || 0) >= 5.0 ? 'text-rose-400' : 'text-amber-400'
          }`}>
            {kpis.max_magnitude_24h !== null ? kpis.max_magnitude_24h.toFixed(1) : '-'}
          </span>
          <span className="text-xs text-slate-400 font-mono">Mw</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          {(kpis.max_magnitude_24h || 0) >= 5.0 ? 'Alerta moderada' : 'Actividad estándar'}
        </div>
      </div>

      {/* 3. Magnitud Promedio */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-4 hover:border-slate-700 transition group shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Promedio (24h)</span>
          <Activity className="w-4 h-4 text-sky-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-white tracking-tight">
            {kpis.avg_magnitude_24h !== null ? kpis.avg_magnitude_24h.toFixed(2) : '-'}
          </span>
          <span className="text-xs text-slate-400 font-mono">Mw</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Media de eventos detectados
        </div>
      </div>

      {/* 4. Alertas Tsunami */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-4 hover:border-slate-700 transition group shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Alertas Tsunami</span>
          <Waves className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className={`text-3xl font-extrabold tracking-tight ${
            kpis.tsunami_alerts_24h > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-100'
          }`}>
            {kpis.tsunami_alerts_24h}
          </span>
          <span className="text-xs text-slate-400 font-mono">activas</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          {kpis.tsunami_alerts_24h === 0 ? 'Sin alertas oceánicas' : 'Revisión prioritaria'}
        </div>
      </div>

      {/* 5. Calidad Pandera */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-4 hover:border-slate-700 transition group shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Calidad Pandera</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">
            {kpis.quality_score.toFixed(0)}%
          </span>
          <span className="text-xs text-emerald-500 font-mono">Score</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center space-x-1">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>Frescura: {freshnessText}</span>
        </div>
      </div>

    </div>
  );
};
