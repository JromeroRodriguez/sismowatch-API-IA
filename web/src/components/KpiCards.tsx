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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" aria-busy="true">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl bg-white border border-slate-200 p-5 shadow-xs animate-pulse flex flex-col justify-between"
          >
            <div className="h-4 bg-slate-100 rounded w-1/2"></div>
            <div className="h-8 bg-slate-100 rounded w-3/4"></div>
            <div className="h-3 bg-slate-100 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const freshnessText =
    kpis.data_freshness_minutes !== null
      ? `${kpis.data_freshness_minutes.toFixed(0)}m atrás`
      : 'Sincronizado';

  const isHighSeverity = (kpis.max_magnitude_24h || 0) >= 5.0;
  const hasTsunami = kpis.tsunami_alerts_24h > 0;

  return (
    <section aria-label="Indicadores Clave del Sistema" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      
      {/* 1. Sismos 24h */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sismos (24h)</span>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight tabular-nums">
              {kpis.total_events_24h}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              / {kpis.total_events_gold} total Gold
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 flex items-center space-x-1.5 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Feed USGS en vivo</span>
          </div>
        </div>
      </div>

      {/* 2. Magnitud Máxima */}
      <div className={`rounded-xl bg-white border p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between ${
        isHighSeverity ? 'border-red-200 bg-red-50/20' : 'border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mag. Máxima (24h)</span>
          <div className={`p-2 rounded-lg ${isHighSeverity ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline space-x-2">
            <span className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
              isHighSeverity ? 'text-red-600' : 'text-slate-900'
            }`}>
              {kpis.max_magnitude_24h !== null ? kpis.max_magnitude_24h.toFixed(1) : '-'}
            </span>
            <span className="text-xs text-slate-500 font-mono font-semibold">Mw</span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">
            {isHighSeverity ? (
              <span className="text-red-600 font-semibold flex items-center space-x-1">
                <span>Alerta sísmica moderada</span>
              </span>
            ) : (
              'Actividad dentro de norma'
            )}
          </div>
        </div>
      </div>

      {/* 3. Magnitud Promedio */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Promedio (24h)</span>
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight tabular-nums">
              {kpis.avg_magnitude_24h !== null ? kpis.avg_magnitude_24h.toFixed(2) : '-'}
            </span>
            <span className="text-xs text-slate-500 font-mono font-semibold">Mw</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Media geométrica calculada
          </div>
        </div>
      </div>

      {/* 4. Alertas Tsunami */}
      <div className={`rounded-xl bg-white border p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between ${
        hasTsunami ? 'border-sky-300 bg-sky-50/20' : 'border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Alertas Tsunami</span>
          <div className={`p-2 rounded-lg ${hasTsunami ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
            <Waves className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline space-x-2">
            <span className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
              hasTsunami ? 'text-sky-600' : 'text-slate-900'
            }`}>
              {kpis.tsunami_alerts_24h}
            </span>
            <span className="text-xs text-slate-500 font-mono">activas</span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">
            {hasTsunami ? (
              <span className="text-sky-700 font-semibold">Revisión oceánica activa</span>
            ) : (
              'Sin eventos tsunamigénicos'
            )}
          </div>
        </div>
      </div>

      {/* 5. Calidad Pandera */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Calidad Pandera</span>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono tracking-tight tabular-nums">
              {kpis.quality_score.toFixed(0)}%
            </span>
            <span className="text-xs text-emerald-700/80 font-mono font-semibold">Score</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center space-x-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Frescura: {freshnessText}</span>
          </div>
        </div>
      </div>

    </section>
  );
};
