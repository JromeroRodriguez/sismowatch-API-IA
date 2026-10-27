import React from 'react';
import { CheckCircle2, AlertTriangle, ArrowRight, Database, Cpu, ShieldCheck } from 'lucide-react';
import { PipelineSummary } from '../types';

interface PipelineModalProps {
  pipeline: PipelineSummary | null;
  loading: boolean;
}

export const PipelineModal: React.FC<PipelineModalProps> = ({ pipeline, loading }) => {
  if (loading || !pipeline) {
    return (
      <div className="py-20 text-center text-slate-400 text-xs animate-pulse font-mono" role="status">
        Consultando métricas de Airflow y Pandera en gold.pipeline_status...
      </div>
    );
  }

  const quality = pipeline.latest_quality;

  return (
    <div className="space-y-6">
      
      {/* 1. Medallion Flow Diagram Card */}
      <div className="rounded-2xl glass-card p-6 shadow-lg border border-white/10">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center space-x-2.5 font-sans">
          <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
            <Database className="w-4 h-4" />
          </div>
          <span>Arquitectura Medallion en PostgreSQL (Flujo Punta a Punta)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Bronze */}
          <div className="p-5 rounded-xl glass-card border border-amber-500/30">
            <div className="flex items-center justify-between text-amber-400 font-mono text-xs font-bold mb-2">
              <span>1. CAPA BRONZE</span>
              <span className="text-[10px] bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">Raw Ingestion</span>
            </div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Ingesta sin mutar desde USGS GeoJSON cada 5 minutos. Almacena el JSON crudo original.
            </p>
            <div className="mt-3.5 text-xs font-mono text-slate-400 pt-2 border-t border-white/5">
              Tabla: <span className="text-amber-300 font-semibold">bronze.earthquakes_raw</span>
            </div>
          </div>

          {/* Silver */}
          <div className="p-5 rounded-xl glass-card border border-slate-500/30">
            <div className="flex items-center justify-between text-slate-200 font-mono text-xs font-bold mb-2">
              <span>2. CAPA SILVER</span>
              <span className="text-[10px] bg-slate-700/60 px-2 py-0.5 rounded-full border border-slate-600">Staging Clean</span>
            </div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Limpieza, tipado y validación estricta con <b>Pandera</b>. Datos corruptos quedan marcados para cuarentena.
            </p>
            <div className="mt-3.5 text-xs font-mono text-slate-400 pt-2 border-t border-white/5">
              Tabla: <span className="text-slate-200 font-semibold">silver.earthquakes_clean</span>
            </div>
          </div>

          {/* Gold */}
          <div className="p-5 rounded-xl glass-card border border-emerald-500/40">
            <div className="flex items-center justify-between text-emerald-400 font-mono text-xs font-bold mb-2">
              <span>3. CAPA GOLD</span>
              <span className="text-[10px] bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">Curated Analytics</span>
            </div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Solo registros válidos que superaron el Quality Gate. Consumida por la API con rol <i>sismo_readonly</i>.
            </p>
            <div className="mt-3.5 text-xs font-mono text-slate-400 pt-2 border-t border-white/5">
              Tabla: <span className="text-emerald-300 font-semibold">gold.earthquakes</span>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Airflow DAGs Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pipeline.statuses.map((st) => {
          const isSuccess = st.state === 'SUCCESS';
          return (
            <div key={st.dag_id} className="p-5 rounded-2xl glass-card shadow-sm border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold text-white">{st.dag_id}</span>
                <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  isSuccess ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-glow-emerald' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}>
                  {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  <span>{st.state || 'UNKNOWN'}</span>
                </span>
              </div>
              <div className="text-xs text-slate-350 space-y-1.5 font-mono">
                <div>Último Run: <span className="text-slate-200">{st.last_run_id?.slice(0, 26) || '-'}...</span></div>
                <div>Último Éxito: <span className="text-emerald-300 font-semibold">{st.last_success_at ? new Date(st.last_success_at).toLocaleTimeString() : '-'}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Pandera Quality Evaluation Metrics */}
      {quality && (
        <div className="p-6 rounded-2xl glass-card shadow-lg border border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-2 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Evaluación de Calidad (Pandera Quality Gate)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/30 shadow-glow-emerald">
              Puntaje: {quality.quality_score.toFixed(1)}% ({quality.status})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-center">
            <div className="p-4 bg-slate-950/70 rounded-xl border border-white/5">
              <div className="text-[11px] text-slate-400 uppercase font-mono font-semibold">Registros Evaluados</div>
              <div className="text-2xl font-extrabold text-white font-mono mt-1.5 tabular-nums">{quality.total_records}</div>
            </div>
            <div className="p-4 bg-slate-950/70 rounded-xl border border-white/5">
              <div className="text-[11px] text-slate-400 uppercase font-mono font-semibold">Reglas Evaluadas</div>
              <div className="text-2xl font-extrabold text-sky-400 font-mono mt-1.5 tabular-nums">{quality.rules_evaluated}</div>
            </div>
            <div className="p-4 bg-slate-950/70 rounded-xl border border-white/5">
              <div className="text-[11px] text-slate-400 uppercase font-mono font-semibold">Reglas Aprobadas</div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1.5 tabular-nums">{quality.rules_passed}</div>
            </div>
            <div className="p-4 bg-slate-950/70 rounded-xl border border-white/5">
              <div className="text-[11px] text-slate-400 uppercase font-mono font-semibold">Rechazados / Descartados</div>
              <div className="text-2xl font-extrabold text-rose-400 font-mono mt-1.5 tabular-nums">{quality.rules_rejected}</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
