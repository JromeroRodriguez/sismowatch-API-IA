import React, { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { Earthquake, TimeSeriesPoint } from '../types';

interface ActivityChartsProps {
  timeSeries: TimeSeriesPoint[];
  earthquakes: Earthquake[];
}

export const ActivityCharts: React.FC<ActivityChartsProps> = ({ timeSeries, earthquakes }) => {
  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null);

  // Group earthquakes by magnitude tier
  const tiers = {
    micro: earthquakes.filter((e) => (e.mag || 0) < 3.0).length,
    menor: earthquakes.filter((e) => (e.mag || 0) >= 3.0 && (e.mag || 0) < 4.5).length,
    moderado: earthquakes.filter((e) => (e.mag || 0) >= 4.5 && (e.mag || 0) < 6.0).length,
    fuerte: earthquakes.filter((e) => (e.mag || 0) >= 6.0).length,
  };

  const total = earthquakes.length || 1;
  const maxCount = Math.max(...timeSeries.map((t) => t.count), 5);

  // Display recent 24 buckets for crisp bar rendering
  const displaySeries = timeSeries.slice(-24);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      
      {/* 1. Time-Series Activity Bars (2 cols) */}
      <div className="lg:col-span-2 rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Frecuencia de Actividad Sísmica (Ventana Reciente)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {hoveredPoint ? (
              <span className="text-amber-400 font-bold">
                {hoveredPoint.count} sismos | Mag Máx: {hoveredPoint.max_mag?.toFixed(1) || '-'}
              </span>
            ) : (
              'Pasa el cursor sobre una barra'
            )}
          </span>
        </div>

        {/* SVG/CSS Bar Chart */}
        <div className="h-44 w-full flex items-end space-x-1.5 pt-6 pb-2 px-1">
          {displaySeries.map((point, index) => {
            const heightPercent = Math.max(8, (point.count / maxCount) * 100);
            const isHovered = hoveredPoint?.time_bucket === point.time_bucket;

            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer"
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t transition-all duration-200 ${
                    isHovered
                      ? 'bg-amber-400 shadow-md shadow-amber-400/50'
                      : (point.max_mag || 0) >= 5.0
                      ? 'bg-rose-500/80 hover:bg-rose-400'
                      : 'bg-slate-700 hover:bg-slate-500'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom time indicators */}
        <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800">
          <span>{displaySeries[0]?.time_bucket?.replace('T', ' ').slice(5, 16) || 'Inicio'}</span>
          <span>Evolución Temporal Horaria</span>
          <span>{displaySeries[displaySeries.length - 1]?.time_bucket?.replace('T', ' ').slice(5, 16) || 'Actual'}</span>
        </div>
      </div>

      {/* 2. Magnitude Distribution Breakdown (1 col) */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center space-x-2 mb-3">
          <TrendingUp className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Distribución por Magnitud
          </h3>
        </div>

        <div className="space-y-3 my-auto">
          {/* Micro */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Menor a 3.0 Mw (Leve)</span>
              <span className="font-mono text-emerald-400 font-bold">
                {tiers.micro} ({((tiers.micro / total) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(tiers.micro / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Menor */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">3.0 - 4.4 Mw (Moderado)</span>
              <span className="font-mono text-amber-400 font-bold">
                {tiers.menor} ({((tiers.menor / total) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(tiers.menor / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Fuerte */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">4.5 - 5.9 Mw (Fuerte)</span>
              <span className="font-mono text-orange-400 font-bold">
                {tiers.moderado} ({((tiers.moderado / total) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-orange-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(tiers.moderado / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Muy Fuerte */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">&ge; 6.0 Mw (Severo)</span>
              <span className="font-mono text-rose-400 font-bold">
                {tiers.fuerte} ({((tiers.fuerte / total) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(tiers.fuerte / total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 text-center font-mono pt-2 border-t border-slate-800">
          Total eventos procesados: {earthquakes.length}
        </div>
      </div>

    </div>
  );
};
