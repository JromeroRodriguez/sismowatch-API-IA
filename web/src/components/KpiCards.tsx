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
            className="h-32 rounded-xl glass-card p-4 animate-pulse flex flex-col justify-between"
          >
            <div className="h-4 bg-slate-800/80 rounded w-1/2"></div>
            <div className="h-9 bg-slate-800/80 rounded w-3/4"></div>
            <div className="h-3 bg-slate-800/80 rounded w-1/3"></div>
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
      <div className="relative overflow-hidden rounded-xl glass-card glass-card-hover p-4 shadow-sm group">
        <div className="flex items-center justify-between text-slate-300 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-350">Sismos (24h)</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
            {kpis.total_events_24h}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            / {kpis.total_events_gold} total Gold
          </span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-400 flex items-center space-x-1.5 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-glow-emerald animate-pulse motion-reduce:animate-none"></span>
          <span>Feed USGS en vivo</span>
        </div>
      </div>

      {/* 2. Magnitud Máxima */}
      <div className={`relative overflow-hidden rounded-xl glass-card glass-card-hover p-4 shadow-sm group ${
        isHighSeverity ? 'border-rose-500/30' : ''
      }`}>
        <div className="flex items-center justify-between text-slate-300 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-350">Mag. Máxima (24h)</span>
          <div className={`p-1.5 rounded-lg ${isHighSeverity ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/10 text-amber-400'} group-hover:scale-110 transition-transform`}>
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className={`text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
            isHighSeverity ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'text-amber-400'
          }`}>
            {kpis.max_magnitude_24h !== null ? kpis.max_magnitude_24h.toFixed(1) : '-'}
          </span>
          <span className="text-xs text-slate-400 font-mono font-semibold">Mw</span>
        </div>
        <div className="mt-2 text-[11px] font-medium text-slate-300">
          {isHighSeverity ? (
            <span className="text-rose-400 font-semibold flex items-center space-x-1">
              <span>Alerta sísmica moderada</span>
            </span>
          ) : (
            'Actividad dentro de norma'
          )}
        </div>
      </div>

      {/* 3. Magnitud Promedio */}
      <div className="relative overflow-hidden rounded-xl glass-card glass-card-hover p-4 shadow-sm group">
        <div className="flex items-center justify-between text-slate-300 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-350">Promedio (24h)</span>
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:scale-110 transition-transform">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
            {kpis.avg_magnitude_24h !== null ? kpis.avg_magnitude_24h.toFixed(2) : '-'}
          </span>
          <span className="text-xs text-slate-400 font-mono font-semibold">Mw</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-350 font-medium">
          Media geométrica calculada
        </div>
      </div>

      {/* 4. Alertas Tsunami */}
      <div className={`relative overflow-hidden rounded-xl glass-card glass-card-hover p-4 shadow-sm group ${
        hasTsunami ? 'border-cyan-500/40' : ''
      }`}>
        <div className="flex items-center justify-between text-slate-300 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-350">Alertas Tsunami</span>
          <div className={`p-1.5 rounded-lg ${hasTsunami ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'} group-hover:scale-110 transition-transform`}>
            <Waves className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className={`text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
            hasTsunami ? 'text-cyan-400 animate-pulse motion-reduce:animate-none drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'text-slate-100'
          }`}>
            {kpis.tsunami_alerts_24h}
          </span>
          <span className="text-xs text-slate-400 font-mono">activas</span>
        </div>
        <div className="mt-2 text-[11px] font-medium text-slate-350">
          {hasTsunami ? (
            <span className="text-cyan-400 font-semibold">Revisión oceánica activa</span>
          ) : (
            'Sin eventos tsunamigénicos'
          )}
        </div>
      </div>

      {/* 5. Calidad Pandera */}
      <div className="relative overflow-hidden rounded-xl glass-card glass-card-hover p-4 shadow-sm group">
        <div className="flex items-center justify-between text-slate-300 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-350">Calidad Pandera</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight tabular-nums drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
            {kpis.quality_score.toFixed(0)}%
          </span>
          <span className="text-xs text-emerald-400/80 font-mono font-semibold">Score</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-350 flex items-center space-x-1.5 font-medium">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Frescura: {freshnessText}</span>
        </div>
      </div>

    </section>
  );
};
