import React, { useState } from 'react';
import { X, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { triggerAdminBackfill } from '../api';

interface AdminBackfillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminBackfillModal: React.FC<AdminBackfillModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [daysBack, setDaysBack] = useState(30);
  const [minMagnitude, setMinMagnitude] = useState(2.5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await triggerAdminBackfill(daysBack, minMagnitude);
      setResult({
        success: true,
        message: res.message || 'Backfill disparado exitosamente en Apache Airflow.',
      });
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Error al disparar backfill',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-labelledby="backfill-modal-title">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Zap className="w-5 h-5" />
            </div>
            <h3 id="backfill-modal-title" className="text-sm font-bold text-slate-900 tracking-wide font-sans">
              Lanzar Backfill Histórico (Airflow)
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ventana de backfill"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed font-normal">
            Esta acción disparará el DAG parametrizado <code className="text-blue-700 font-mono font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">historical_backfill_dag</code> a través de la API REST oficial de Airflow.
          </p>

          <div>
            <label htmlFor="backfill-days" className="block text-slate-700 font-semibold mb-2">
              Días hacia atrás a sincronizar: <span className="text-blue-700 font-mono font-bold">{daysBack} días</span>
            </label>
            <input
              id="backfill-days"
              type="range"
              min="1"
              max="90"
              value={daysBack}
              onChange={(e) => setDaysBack(parseInt(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
              <span>1 día</span>
              <span>30 días (estándar)</span>
              <span>90 días</span>
            </div>
          </div>

          <div>
            <label htmlFor="backfill-mag" className="block text-slate-700 font-semibold mb-1.5">
              Magnitud mínima de corte (&ge; {minMagnitude.toFixed(1)} Mw)
            </label>
            <input
              id="backfill-mag"
              type="number"
              step="0.1"
              min="0.0"
              max="9.0"
              value={minMagnitude}
              onChange={(e) => setMinMagnitude(parseFloat(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded-lg flex items-start space-x-2.5 text-xs font-medium ${
                result.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
              role="alert"
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[38px] rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium transition focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 min-h-[38px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition disabled:opacity-50 shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {loading ? 'Disparando en Airflow...' : 'Lanzar Ejecución'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
