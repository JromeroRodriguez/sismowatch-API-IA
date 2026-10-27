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
      <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Frecuencia de Actividad Sísmica (Ventana Reciente)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {hoveredPoint ? (
              <span className="text-blue-700 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                {hoveredPoint.count} sismos &bull; Mag Máx: {hoveredPoint.max_mag?.toFixed(1) || '-'} Mw
              </span>
            ) : (
              'Pasa el cursor sobre una barra'
            )}
          </span>
        </div>

        {/* SVG/CSS Bar Chart with Subtle Background Line */}
        <div className="h-44 w-full flex items-end space-x-1.5 pt-6 pb-2 px-1 relative">
          <div className="absolute inset-x-0 bottom-2 border-b border-slate-100 pointer-events-none"></div>
          <div className="absolute inset-x-0 top-1/2 border-b border-slate-50 border-dashed pointer-events-none"></div>

          {displaySeries.map((point, index) => {
            const heightPercent = Math.max(8, (point.count / maxCount) * 100);
            const isHovered = hoveredPoint?.time_bucket === point.time_bucket;
            const isHighMag = (point.max_mag || 0) >= 5.0;

            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer focus:outline-none z-10"
                tabIndex={0}
                aria-label={`Hora ${point.time_bucket}: ${point.count} sismos`}
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
                onFocus={() => setHoveredPoint(point)}
                onBlur={() => setHoveredPoint(null)}
              >
                {/* Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t transition-all duration-150 ${
                    isHovered
                      ? 'bg-blue-700 shadow-xs scale-y-105'
                      : isHighMag
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-blue-600/80 hover:bg-blue-600'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom time indicators */}
        <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-3 border-t border-slate-100">
          <span>{displaySeries[0]?.time_bucket?.replace('T', ' ').slice(5, 16) || 'Inicio'}</span>
          <span className="font-sans font-medium text-slate-500">Evolución Horaria Continua</span>
          <span>{displaySeries[displaySeries.length - 1]?.time_bucket?.replace('T', ' ').slice(5, 16) || 'Actual'}</span>
        </div>
      </div>

      {/* 2. Magnitude Distribution Breakdown (1 col) */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center space-x-2.5 mb-3">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Distribución por Magnitud
          </h3>
        </div>

        <div className="space-y-3.5 my-auto">
          {/* Micro */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 font-medium">Menor a 3.0 Mw (Leve)</span>
              <span className="font-mono text-emerald-700 font-bold tabular-nums">
                {tiers.micro} ({((tiers.micro / total) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(tiers.micro / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Menor */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 font-medium">3.0 - 4.4 Mw (Moderado)</span>
              <span className="font-mono text-amber-700 font-bold tabular-nums">
                {tiers.menor} ({((tiers.menor / total) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(tiers.menor / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Fuerte */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 font-medium">4.5 - 5.9 Mw (Fuerte)</span>
              <span className="font-mono text-orange-700 font-bold tabular-nums">
                {tiers.moderado} ({((tiers.moderado / total) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-orange-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(tiers.moderado / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Muy Fuerte */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 font-medium">&ge; 6.0 Mw (Severo)</span>
              <span className="font-mono text-red-700 font-bold tabular-nums">
                {tiers.fuerte} ({((tiers.fuerte / total) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-red-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(tiers.fuerte / total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 text-center font-mono pt-3 border-t border-slate-100">
          Total eventos procesados: <span className="text-slate-800 font-bold">{earthquakes.length}</span>
        </div>
      </div>

    </div>
  );
};
