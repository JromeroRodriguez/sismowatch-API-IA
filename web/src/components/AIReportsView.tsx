import React, { useState } from 'react';
import { Bot, Sparkles, AlertTriangle, Cpu, DollarSign, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { AnomalyItem, ReportItem, UserSession } from '../types';
import { regenerateAIReport } from '../api';

interface AIReportsViewProps {
  reports: ReportItem[];
  anomalies: AnomalyItem[];
  session: UserSession;
  onRefresh: () => void;
  loading: boolean;
}

export const AIReportsView: React.FC<AIReportsViewProps> = ({
  reports,
  anomalies,
  session,
  onRefresh,
  loading,
}) => {
  const [regenerating, setRegenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setStatusMsg(null);
    try {
      const res = await regenerateAIReport();
      setStatusMsg(res.message || 'Regeneración solicitada.');
      setTimeout(() => {
        onRefresh();
        setStatusMsg(null);
      }, 3000);
    } catch (err: any) {
      alert(err.message || 'Error al regenerar reporte');
    } finally {
      setRegenerating(false);
    }
  };

  const latestReport = reports[0];

  return (
    <div className="space-y-6">
      
      {/* 1. Header with Groq Model Badge & Admin Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white">Centro de Inteligencia Sismológica (SismoAI)</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Groq &bull; openai/gpt-oss-120b
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cálculo matemático determinístico en SQL/Python con redacción ejecutiva en lenguaje natural.
            </p>
          </div>
        </div>

        {/* Admin Regenerate Button (STRICTLY HIDDEN FOR VIEWER) */}
        {session.role === 'admin' && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            <span>{regenerating ? 'Lanzando en Airflow...' : 'Regenerar Reporte IA'}</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* 2. Latest AI Executive Report */}
      {latestReport ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">
                Reporte Oficial &bull; {latestReport.report_date}
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                {latestReport.title || `Reporte Sismológico - ${latestReport.report_date}`}
              </h3>
            </div>

            {/* AI Execution Telemetry */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="flex items-center space-x-1 bg-slate-850 px-2 py-1 rounded border border-slate-800">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>{latestReport.model_used}</span>
              </span>
              <span className="flex items-center space-x-1 bg-slate-850 px-2 py-1 rounded border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>{latestReport.latency_ms} ms</span>
              </span>
              <span className="flex items-center space-x-1 bg-slate-850 px-2 py-1 rounded border border-slate-800">
                <span>Tokens: <b className="text-slate-200">{latestReport.tokens_used}</b></span>
              </span>
              <span className="flex items-center space-x-1 bg-slate-850 px-2 py-1 rounded border border-slate-800">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>${latestReport.cost_estimate_usd.toFixed(6)} USD</span>
              </span>
            </div>
          </div>

          {/* Narrative Content */}
          <div className="prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed space-y-3 font-sans whitespace-pre-line">
            {latestReport.summary_narrative}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500 text-xs">
          No hay reportes de IA generados aún. Dispara el DAG daily_ai_report_dag para generar el primero.
        </div>
      )}

      {/* 3. Anomalies Section */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Anomalías Sísmicas Detectadas ({anomalies.length} eventos atípicos)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Algoritmo: Z-Score &ge; 2.0 &bull; Subducción Profunda
          </span>
        </div>

        {anomalies.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No se han registrado anomalías estadísticas en el intervalo analizado.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {anomalies.map((anom) => (
              <div
                key={anom.id}
                className="p-4 rounded-xl bg-slate-850 border border-slate-800 hover:border-slate-700 transition space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500">ID: {anom.event_id}</span>
                    <h4 className="text-xs font-bold text-slate-200">{anom.place || 'Lugar desconocido'}</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    {anom.magnitude?.toFixed(1)} Mw
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
                  <span>Prof: <b className="text-slate-300">{anom.depth_km?.toFixed(1)} km</b></span>
                  <span>Z-Score: <b className="text-amber-400">{anom.anomaly_score?.toFixed(2)}</b></span>
                  <span>Método: <b className="text-sky-400">{anom.technique}</b></span>
                </div>

                <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  {anom.explanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
