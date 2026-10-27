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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4" role="dialog" aria-modal="true" aria-labelledby="backfill-modal-title">
      <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-5 glass-panel border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 id="backfill-modal-title" className="text-sm font-extrabold text-white uppercase tracking-wider font-sans">
              Lanzar Backfill Histórico (Airflow)
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ventana de backfill"
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800/80 transition focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <p className="text-slate-350 leading-relaxed font-medium">
            Esta acción disparará el DAG parametrizado <code className="text-amber-400 font-mono font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">historical_backfill_dag</code> a través de la API REST oficial de Airflow.
          </p>

          <div>
            <label htmlFor="backfill-days" className="block text-slate-200 font-semibold mb-2">
              Días hacia atrás a sincronizar: <span className="text-amber-400 font-mono font-bold">{daysBack} días</span>
            </label>
            <input
              id="backfill-days"
              type="range"
              min="1"
              max="90"
              value={daysBack}
              onChange={(e) => setDaysBack(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-1">
              <span>1 día</span>
              <span>30 días (estándar)</span>
              <span>90 días</span>
            </div>
          </div>

          <div>
            <label htmlFor="backfill-mag" className="block text-slate-200 font-semibold mb-1.5">
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
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 transition"
            />
          </div>

          {result && (
            <div
              className={`p-3.5 rounded-xl flex items-start space-x-2.5 text-xs font-medium shadow-sm ${
                result.success
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}
              role="alert"
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[40px] rounded-xl bg-slate-850 hover:bg-slate-800 border border-white/10 text-slate-300 font-semibold transition focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-glow-amber transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {loading ? 'Disparando en Airflow...' : 'Lanzar Ejecución'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
