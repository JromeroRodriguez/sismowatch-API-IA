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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Lanzar Backfill Histórico (Airflow)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <p className="text-slate-400">
            Esta acción disparará el DAG parametrizado <code className="text-amber-400 font-mono">historical_backfill_dag</code> a través de la API REST oficial de Airflow.
          </p>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Días hacia atrás a sincronizar ({daysBack} días)
            </label>
            <input
              type="range"
              min="1"
              max="90"
              value={daysBack}
              onChange={(e) => setDaysBack(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
              <span>1 día</span>
              <span>30 días (estándar)</span>
              <span>90 días</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Magnitud mínima de corte (&ge; {minMagnitude.toFixed(1)} Mw)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.0"
              max="9.0"
              value={minMagnitude}
              onChange={(e) => setMinMagnitude(parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded-lg flex items-start space-x-2 text-xs font-medium ${
                result.success
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition disabled:opacity-50"
            >
              {loading ? 'Disparando en Airflow...' : 'Lanzar Ejecución'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
