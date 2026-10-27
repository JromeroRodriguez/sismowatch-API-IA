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
      <div className="py-12 text-center text-slate-500 text-xs animate-pulse">
        Consultando métricas de Airflow y Pandera en gold.pipeline_status...
      </div>
    );
  }

  const quality = pipeline.latest_quality;

  return (
    <div className="space-y-6">
      
      {/* 1. Medallion Flow Diagram Card */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4 flex items-center space-x-2">
          <Database className="w-4 h-4 text-amber-400" />
          <span>Arquitectura Medallion en PostgreSQL (Flujo Punta a Punta)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Bronze */}
          <div className="p-4 rounded-lg bg-slate-850 border border-amber-500/20">
            <div className="flex items-center justify-between text-amber-400 font-mono text-xs font-bold mb-1">
              <span>1. CAPA BRONZE</span>
              <span className="text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded">Raw Data</span>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Ingesta sin mutar desde USGS GeoJSON cada 5 minutos. Almacena el JSON crudo original.
            </p>
            <div className="mt-3 text-[11px] font-mono text-slate-400">
              Tabla: <span className="text-slate-200">bronze.earthquakes_raw</span>
            </div>
          </div>

          {/* Silver */}
          <div className="p-4 rounded-lg bg-slate-850 border border-slate-500/20">
            <div className="flex items-center justify-between text-slate-300 font-mono text-xs font-bold mb-1">
              <span>2. CAPA SILVER</span>
              <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded">Staging</span>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Limpieza, tipado y validación estricta con <b>Pandera</b>. Datos anómalos o corruptos se descartan aquí.
            </p>
            <div className="mt-3 text-[11px] font-mono text-slate-400">
              Tabla: <span className="text-slate-200">silver.earthquakes_clean</span>
            </div>
          </div>

          {/* Gold */}
          <div className="p-4 rounded-lg bg-slate-850 border border-emerald-500/30">
            <div className="flex items-center justify-between text-emerald-400 font-mono text-xs font-bold mb-1">
              <span>3. CAPA GOLD</span>
              <span className="text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">Curated</span>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Solo registros válidos que superaron el Quality Gate. Consumida por la API con rol <i>sismo_readonly</i>.
            </p>
            <div className="mt-3 text-[11px] font-mono text-slate-400">
              Tabla: <span className="text-slate-200">gold.earthquakes</span>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Airflow DAGs Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pipeline.statuses.map((st) => {
          const isSuccess = st.state === 'SUCCESS';
          return (
            <div key={st.dag_id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-slate-200">{st.dag_id}</span>
                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isSuccess ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  <span>{st.state || 'UNKNOWN'}</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                <div>Último Run: <span className="text-slate-300">{st.last_run_id?.slice(0, 25) || '-'}...</span></div>
                <div>Éxito: <span className="text-slate-300">{st.last_success_at ? new Date(st.last_success_at).toLocaleTimeString() : '-'}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Pandera Quality Evaluation Metrics */}
      {quality && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Última Evaluación de Calidad (Pandera Quality Gate)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
              Puntaje: {quality.quality_score.toFixed(1)}% ({quality.status})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-slate-850 rounded-lg">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Registros Evaluados</div>
              <div className="text-xl font-bold text-white font-mono mt-1">{quality.total_records}</div>
            </div>
            <div className="p-3 bg-slate-850 rounded-lg">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Reglas Evaluadas</div>
              <div className="text-xl font-bold text-sky-400 font-mono mt-1">{quality.rules_evaluated}</div>
            </div>
            <div className="p-3 bg-slate-850 rounded-lg">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Reglas Aprobadas</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{quality.rules_passed}</div>
            </div>
            <div className="p-3 bg-slate-850 rounded-lg">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Rechazados / Descartados</div>
              <div className="text-xl font-bold text-rose-400 font-mono mt-1">{quality.rules_rejected}</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
