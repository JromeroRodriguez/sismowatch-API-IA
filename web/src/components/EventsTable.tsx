import React, { useState } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Waves, ExternalLink } from 'lucide-react';
import { Earthquake } from '../types';
import { downloadExport } from '../api';

interface EventsTableProps {
  events: Earthquake[];
  total: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  minMagFilter: number | undefined;
  onMinMagChange: (m: number | undefined) => void;
  onSelectEvent: (event: Earthquake) => void;
  loading: boolean;
}

export const EventsTable: React.FC<EventsTableProps> = ({
  events,
  total,
  currentPage,
  totalPages,
  onPageChange,
  searchQuery,
  onSearchChange,
  minMagFilter,
  onMinMagChange,
  onSelectEvent,
  loading,
}) => {
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(format);
      await downloadExport(format, minMagFilter);
    } catch (err: any) {
      alert(`Error al exportar: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="rounded-xl glass-card shadow-lg overflow-hidden flex flex-col border border-white/10">
      
      {/* Top Filter & Export Bar */}
      <div className="p-4 glass-panel border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        
        {/* Left: Search & Magnitude filter */}
        <div className="flex flex-1 items-center space-x-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              aria-label="Buscar sismos por región o país"
              placeholder="Buscar por región (ej. California, Chile, Japón)..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 transition"
            />
          </div>

          <select
            aria-label="Filtrar por magnitud mínima"
            value={minMagFilter === undefined ? '' : minMagFilter}
            onChange={(e) => onMinMagChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
            className="bg-slate-950/80 border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 transition cursor-pointer"
          >
            <option value="">Todas las magnitudes</option>
            <option value="2.5">&ge; 2.5 Mw (Perceptibles)</option>
            <option value="4.0">&ge; 4.0 Mw (Moderados)</option>
            <option value="5.0">&ge; 5.0 Mw (Fuertes)</option>
            <option value="6.0">&ge; 6.0 Mw (Severos)</option>
          </select>
        </div>

        {/* Right: Export buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            aria-label="Exportar datos a formato CSV"
            className="flex items-center space-x-2 px-3.5 py-2 min-h-[38px] rounded-xl bg-slate-850 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-semibold transition hover:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{exporting === 'csv' ? 'Generando...' : 'Exportar CSV'}</span>
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            aria-label="Exportar reporte a formato PDF"
            className="flex items-center space-x-2 px-3.5 py-2 min-h-[38px] rounded-xl bg-slate-850 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-semibold transition hover:border-rose-500/40 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>{exporting === 'pdf' ? 'Generando...' : 'Exportar PDF'}</span>
          </button>
        </div>

      </div>

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[320px]">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-xs animate-pulse font-mono" role="status">
            Sincronizando registros desde la capa Gold (PostgreSQL)...
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <p className="text-sm font-semibold text-slate-300">No se encontraron eventos sísmicos con los filtros actuales.</p>
            <p className="text-xs text-slate-400 mt-1">Prueba reduciendo el umbral de magnitud o modificando la búsqueda por región.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs" aria-label="Tabla de eventos sísmicos Gold">
            <thead className="bg-slate-950/90 text-slate-400 border-b border-white/10 uppercase font-mono tracking-wider text-[11px]">
              <tr>
                <th scope="col" className="py-3 px-4">Magnitud</th>
                <th scope="col" className="py-3 px-4">Ubicación / Región</th>
                <th scope="col" className="py-3 px-4">Fecha & Hora (UTC)</th>
                <th scope="col" className="py-3 px-4">Profundidad</th>
                <th scope="col" className="py-3 px-4">Alertas</th>
                <th scope="col" className="py-3 px-4 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {events.map((ev) => {
                const mag = ev.mag || 0;
                let badgeBg = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                if (mag >= 6.0) badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-glow-rose';
                else if (mag >= 4.5) badgeBg = 'bg-orange-500/20 text-orange-300 border-orange-500/30';
                else if (mag >= 3.0) badgeBg = 'bg-amber-500/15 text-amber-300 border-amber-500/30';

                return (
                  <tr
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectEvent(ev);
                      }
                    }}
                    className="hover:bg-slate-800/50 focus:bg-slate-800/60 focus:outline-none transition cursor-pointer group"
                    aria-label={`Sismo de magnitud ${mag.toFixed(1)} en ${ev.place}`}
                  >
                    {/* Magnitude badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border tabular-nums ${badgeBg}`}>
                        {mag.toFixed(1)} Mw
                      </span>
                    </td>

                    {/* Place */}
                    <td className="py-3 px-4 font-semibold text-slate-200 group-hover:text-amber-400 transition">
                      {ev.place || 'Lugar no especificado'}
                    </td>

                    {/* Time */}
                    <td className="py-3 px-4 text-slate-350 font-mono text-xs whitespace-nowrap tabular-nums">
                      {new Date(ev.time).toLocaleString('es-ES', { timeZone: 'UTC' })} UTC
                    </td>

                    {/* Depth */}
                    <td className="py-3 px-4 text-slate-350 font-mono text-xs whitespace-nowrap tabular-nums">
                      {ev.depth_km !== null ? `${ev.depth_km.toFixed(1)} km` : '-'}
                    </td>

                    {/* Alertas */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {ev.tsunami === 1 ? (
                        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700 text-[10px] font-bold tracking-wider">
                          <Waves className="w-3.5 h-3.5" />
                          <span>TSUNAMI</span>
                        </span>
                      ) : (
                        <span className="text-slate-450 font-mono text-[11px]">Normal</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {ev.url ? (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Ver detalles oficiales del sismo en USGS para ${ev.place}`}
                          className="inline-flex items-center space-x-1 text-slate-400 hover:text-amber-400 text-xs font-medium p-1 transition focus-visible:ring-1 focus-visible:ring-amber-500 rounded"
                        >
                          <span>USGS</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3.5 glass-panel border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-350">
        <div>
          Mostrando <span className="text-white font-bold tabular-nums">{events.length}</span> de{' '}
          <span className="text-white font-bold tabular-nums">{total}</span> sismos registrados en Gold
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            aria-label="Página anterior"
            className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-850 hover:bg-slate-800 border border-white/10 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-mono text-xs text-slate-200 px-2 font-semibold">
            Página <span className="text-amber-400">{currentPage}</span> de {totalPages}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            aria-label="Página siguiente"
            className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-850 hover:bg-slate-800 border border-white/10 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
