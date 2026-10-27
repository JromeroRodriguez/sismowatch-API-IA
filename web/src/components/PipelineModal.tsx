import React from 'react';
import { CheckCircle2, AlertTriangle, Database, ShieldCheck } from 'lucide-react';
import { PipelineSummary } from '../types';

interface PipelineModalProps {
  pipeline: PipelineSummary | null;
  loading: boolean;
}

export const PipelineModal: React.FC<PipelineModalProps> = ({ pipeline, loading }) => {
  if (loading || !pipeline) {
    return (
      <div className="py-20 text-center text-slate-500 text-xs animate-pulse font-mono" role="status">
        Consultando métricas de Airflow y Pandera en gold.pipeline_status...
      </div>
    );
  }

  const quality = pipeline.latest_quality;

  return (
    <div className="space-y-6">
      
      {/* 1. Medallion Flow Diagram Card */}
      <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center space-x-2.5 font-sans">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Database className="w-4 h-4" />
          </div>
          <span>Arquitectura Medallion en PostgreSQL (Flujo Punta a Punta)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Bronze */}
          <div className="p-5 rounded-xl bg-white border border-amber-200 shadow-xs">
            <div className="flex items-center justify-between text-amber-700 font-mono text-xs font-bold mb-2">
              <span>1. CAPA BRONZE</span>
              <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">Raw Ingestion</span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Ingesta sin mutar desde USGS GeoJSON cada 5 minutos. Almacena el JSON crudo original.
            </p>
            <div className="mt-3.5 text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
              Tabla: <span className="text-amber-800 font-semibold">bronze.earthquakes_raw</span>
            </div>
          </div>

          {/* Silver */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-700 font-mono text-xs font-bold mb-2">
              <span>2. CAPA SILVER</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">Staging Clean</span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Limpieza, tipado y validación estricta con <b>Pandera</b>. Datos corruptos quedan descartados.
            </p>
            <div className="mt-3.5 text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
              Tabla: <span className="text-slate-800 font-semibold">silver.earthquakes_clean</span>
            </div>
          </div>

          {/* Gold */}
          <div className="p-5 rounded-xl bg-white border border-emerald-200 shadow-xs">
            <div className="flex items-center justify-between text-emerald-700 font-mono text-xs font-bold mb-2">
              <span>3. CAPA GOLD</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">Curated Analytics</span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Solo registros válidos que superaron el Quality Gate. Consumida por la API con rol <i>sismo_readonly</i>.
            </p>
            <div className="mt-3.5 text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
              Tabla: <span className="text-emerald-800 font-semibold">gold.earthquakes</span>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Airflow DAGs Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pipeline.statuses.map((st) => {
          const isSuccess = st.state === 'SUCCESS';
          return (
            <div key={st.dag_id} className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold text-slate-900">{st.dag_id}</span>
                <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  isSuccess ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
                  <span>{st.state || 'UNKNOWN'}</span>
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5 font-mono">
                <div>Último Run: <span className="text-slate-800">{st.last_run_id?.slice(0, 26) || '-'}...</span></div>
                <div>Último Éxito: <span className="text-emerald-700 font-semibold">{st.last_success_at ? new Date(st.last_success_at).toLocaleTimeString() : '-'}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Pandera Quality Evaluation Metrics */}
      {quality && (
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Evaluación de Calidad (Pandera Quality Gate)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Puntaje: {quality.quality_score.toFixed(1)}% ({quality.status})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-center">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[11px] text-slate-500 uppercase font-mono font-semibold">Registros Evaluados</div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1.5 tabular-nums">{quality.total_records}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[11px] text-slate-500 uppercase font-mono font-semibold">Reglas Evaluadas</div>
              <div className="text-2xl font-extrabold text-blue-600 font-mono mt-1.5 tabular-nums">{quality.rules_evaluated}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[11px] text-slate-500 uppercase font-mono font-semibold">Reglas Aprobadas</div>
              <div className="text-2xl font-extrabold text-emerald-600 font-mono mt-1.5 tabular-nums">{quality.rules_passed}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[11px] text-slate-500 uppercase font-mono font-semibold">Rechazados / Descartados</div>
              <div className="text-2xl font-extrabold text-red-600 font-mono mt-1.5 tabular-nums">{quality.rules_rejected}</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
