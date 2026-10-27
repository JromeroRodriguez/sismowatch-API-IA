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
    <div className="rounded-xl bg-slate-900 border border-slate-800 shadow-sm overflow-hidden flex flex-col">
      
      {/* Top Filter & Export Bar */}
      <div className="p-4 bg-slate-850 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Left: Search & Magnitude filter */}
        <div className="flex flex-1 items-center space-x-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por región (ej. California, Chile, Japón)..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={minMagFilter === undefined ? '' : minMagFilter}
            onChange={(e) => onMinMagChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="">Todas las magnitudes</option>
            <option value="2.5">&ge; 2.5 Mw (Perceptibles)</option>
            <option value="4.0">&ge; 4.0 Mw (Moderados)</option>
            <option value="5.0">&ge; 5.0 Mw (Fuertes)</option>
            <option value="6.0">&ge; 6.0 Mw (Severos)</option>
          </select>
        </div>

        {/* Right: Export buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>{exporting === 'csv' ? 'Generando...' : 'Exportar CSV'}</span>
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span>{exporting === 'pdf' ? 'Generando...' : 'Exportar PDF'}</span>
          </button>
        </div>

      </div>

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-xs animate-pulse">
            Cargando registros desde la capa Gold...
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <p className="text-sm font-medium">No se encontraron sismos con los filtros actuales.</p>
            <p className="text-xs text-slate-600 mt-1">Prueba reduciendo la magnitud mínima o cambiando la búsqueda.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Magnitud</th>
                <th className="py-2.5 px-4">Ubicación / Región</th>
                <th className="py-2.5 px-4">Fecha & Hora (UTC)</th>
                <th className="py-2.5 px-4">Profundidad</th>
                <th className="py-2.5 px-4">Alertas</th>
                <th className="py-2.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {events.map((ev) => {
                const mag = ev.mag || 0;
                let badgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                if (mag >= 6.0) badgeBg = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                else if (mag >= 4.5) badgeBg = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                else if (mag >= 3.0) badgeBg = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                return (
                  <tr
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    className="hover:bg-slate-850/60 transition cursor-pointer group"
                  >
                    {/* Magnitude badge */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${badgeBg}`}>
                        {mag.toFixed(1)} Mw
                      </span>
                    </td>

                    {/* Place */}
                    <td className="py-2.5 px-4 font-medium text-slate-200 group-hover:text-amber-400 transition">
                      {ev.place || 'Lugar no especificado'}
                    </td>

                    {/* Time */}
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(ev.time).toLocaleString('es-ES', { timeZone: 'UTC' })} UTC
                    </td>

                    {/* Depth */}
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {ev.depth_km !== null ? `${ev.depth_km.toFixed(1)} km` : '-'}
                    </td>

                    {/* Alertas */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {ev.tsunami === 1 ? (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-semibold">
                          <Waves className="w-3 h-3" />
                          <span>TSUNAMI</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">Normal</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {ev.url ? (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center space-x-1 text-slate-400 hover:text-amber-400 text-[11px] transition"
                        >
                          <span>USGS</span>
                          <ExternalLink className="w-3 h-3" />
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
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div>
          Mostrando <span className="text-slate-200 font-medium">{events.length}</span> de{' '}
          <span className="text-slate-200 font-medium">{total}</span> sismos registrados en Gold
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="p-1 rounded-md bg-slate-850 hover:bg-slate-800 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-mono text-xs text-slate-300">
            Página {currentPage} de {totalPages}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="p-1 rounded-md bg-slate-850 hover:bg-slate-800 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
