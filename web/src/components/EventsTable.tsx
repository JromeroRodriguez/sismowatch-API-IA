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

  const getMagBadge = (mag: number) => {
    if (mag >= 6.0) {
      return 'bg-red-50 text-red-700 border-red-200 font-bold';
    }
    if (mag >= 4.5) {
      return 'bg-orange-50 text-orange-700 border-orange-200 font-semibold';
    }
    if (mag >= 3.0) {
      return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
    }
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
  };

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      
      {/* Top Filter & Export Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        
        {/* Left: Search & Magnitude filter */}
        <div className="flex flex-1 items-center space-x-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              aria-label="Buscar sismos por región o país"
              placeholder="Buscar por región (ej. California, Chile, Japón)..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          <select
            aria-label="Filtrar por magnitud mínima"
            value={minMagFilter === undefined ? '' : minMagFilter}
            onChange={(e) => onMinMagChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-3 py-2 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition cursor-pointer"
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
            className="flex items-center space-x-2 px-3.5 py-2 min-h-[36px] rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{exporting === 'csv' ? 'Generando...' : 'Exportar CSV'}</span>
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            aria-label="Exportar reporte a formato PDF"
            className="flex items-center space-x-2 px-3.5 py-2 min-h-[36px] rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition hover:border-red-300 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 shadow-xs"
          >
            <FileText className="w-4 h-4 text-red-600" />
            <span>{exporting === 'pdf' ? 'Generando...' : 'Exportar PDF'}</span>
          </button>
        </div>

      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto min-h-[320px]">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-xs animate-pulse font-mono" role="status">
            Sincronizando registros desde la capa Gold (PostgreSQL)...
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <p className="text-sm font-semibold text-slate-700">No se encontraron eventos sísmicos con los filtros actuales.</p>
            <p className="text-xs text-slate-500 mt-1">Prueba reduciendo el umbral de magnitud o modificando la búsqueda por región.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs" aria-label="Tabla de eventos sísmicos Gold">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-mono tracking-wider text-[11px] font-semibold">
              <tr>
                <th scope="col" className="py-3 px-4">Magnitud</th>
                <th scope="col" className="py-3 px-4">Ubicación / Región</th>
                <th scope="col" className="py-3 px-4">Fecha & Hora (UTC)</th>
                <th scope="col" className="py-3 px-4">Profundidad</th>
                <th scope="col" className="py-3 px-4">Alertas</th>
                <th scope="col" className="py-3 px-4 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {events.map((ev) => {
                const mag = ev.mag || 0;
                const badgeBg = getMagBadge(mag);

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
                    className="hover:bg-slate-50/80 focus:bg-slate-50 focus:outline-none transition-colors cursor-pointer group"
                    aria-label={`Sismo de magnitud ${mag.toFixed(1)} en ${ev.place}`}
                  >
                    {/* Magnitude badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border tabular-nums ${badgeBg}`}>
                        {mag.toFixed(1)} Mw
                      </span>
                    </td>

                    {/* Place */}
                    <td className="py-3 px-4 font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                      {ev.place || 'Lugar no especificado'}
                    </td>

                    {/* Time */}
                    <td className="py-3 px-4 text-slate-500 font-mono text-xs whitespace-nowrap tabular-nums">
                      {new Date(ev.time).toLocaleString('es-ES', { timeZone: 'UTC' })} UTC
                    </td>

                    {/* Depth */}
                    <td className="py-3 px-4 text-slate-600 font-mono text-xs whitespace-nowrap tabular-nums">
                      {ev.depth_km !== null ? `${ev.depth_km.toFixed(1)} km` : '-'}
                    </td>

                    {/* Alertas */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {ev.tsunami === 1 ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold tracking-wider">
                          <Waves className="w-3 h-3" />
                          <span>TSUNAMI</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">Normal</span>
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
                          className="inline-flex items-center space-x-1 text-slate-500 hover:text-blue-600 text-xs font-medium p-1 transition rounded"
                        >
                          <span>USGS</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Stacked Card View (< 640px) */}
      <div className="sm:hidden divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs animate-pulse font-mono">
            Cargando sismos...
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No se encontraron eventos con los filtros actuales.
          </div>
        ) : (
          events.map((ev) => {
            const mag = ev.mag || 0;
            const badgeBg = getMagBadge(mag);

            return (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev)}
                className="p-4 space-y-2 hover:bg-slate-50 cursor-pointer active:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border tabular-nums ${badgeBg}`}>
                    {mag.toFixed(1)} Mw
                  </span>
                  {ev.tsunami === 1 && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                      <Waves className="w-3 h-3" />
                      <span>TSUNAMI</span>
                    </span>
                  )}
                </div>

                <div className="font-medium text-slate-900 text-xs">
                  {ev.place || 'Lugar no especificado'}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>{new Date(ev.time).toLocaleDateString()}</span>
                  <span>Prof: {ev.depth_km} km</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Mostrando <span className="text-slate-900 font-semibold tabular-nums">{events.length}</span> de{' '}
          <span className="text-slate-900 font-semibold tabular-nums">{total}</span> sismos registrados en Gold
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            aria-label="Página anterior"
            className="p-1.5 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-mono text-xs text-slate-700 px-2 font-medium">
            Página <span className="font-bold text-blue-700">{currentPage}</span> de {totalPages}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            aria-label="Página siguiente"
            className="p-1.5 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
