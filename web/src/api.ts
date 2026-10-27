import {
  KPIsResponse,
  PaginatedEarthquakes,
  PipelineSummary,
  TimeSeriesPoint,
  UserSession,
  ReportItem,
  AnomalyItem,
  QuarantineItem,
} from './types';

const API_BASE = ''; // uses Vite proxy

export const getStoredSession = (): UserSession | null => {
  const data = localStorage.getItem('sismowatch_session');
  if (!data) return null;
  try {
    return JSON.parse(data) as UserSession;
  } catch {
    localStorage.removeItem('sismowatch_session');
    return null;
  }
};

export const saveSession = (session: UserSession) => {
  localStorage.setItem('sismowatch_session', JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem('sismowatch_session');
};

const getAuthHeaders = (): HeadersInit => {
  const session = getStoredSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
};

export async function loginUser(username: string, password: string): Promise<UserSession> {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Credenciales inválidas' }));
    throw new Error(err.detail || 'Fallo de autenticación');
  }

  const data = await resp.json();
  const session: UserSession = {
    username: data.username,
    role: data.role,
    token: data.access_token,
  };
  saveSession(session);
  return session;
}

export async function fetchKPIs(): Promise<KPIsResponse> {
  const resp = await fetch(`${API_BASE}/api/kpis`, { headers: getAuthHeaders() });
  if (resp.status === 401) {
    clearSession();
    window.location.reload();
  }
  if (!resp.ok) throw new Error('Error al cargar indicadores clave (KPIs)');
  return resp.json();
}

export async function fetchEvents(params: {
  page?: number;
  pageSize?: number;
  minMag?: number;
  search?: string;
}): Promise<PaginatedEarthquakes> {
  const q = new URLSearchParams();
  if (params.page) q.append('page', params.page.toString());
  if (params.pageSize) q.append('page_size', params.pageSize.toString());
  if (params.minMag !== undefined && params.minMag !== null) q.append('min_mag', params.minMag.toString());
  if (params.search) q.append('search', params.search);

  const resp = await fetch(`${API_BASE}/api/events?${q.toString()}`, { headers: getAuthHeaders() });
  if (resp.status === 401) {
    clearSession();
    window.location.reload();
  }
  if (!resp.ok) throw new Error('Error al cargar eventos sísmicos');
  return resp.json();
}

export async function fetchTimeSeries(days = 7, interval = 'hour'): Promise<TimeSeriesPoint[]> {
  const resp = await fetch(`${API_BASE}/api/stats/timeseries?days=${days}&interval=${interval}`, {
    headers: getAuthHeaders(),
  });
  if (resp.status === 401) {
    clearSession();
    window.location.reload();
  }
  if (!resp.ok) throw new Error('Error al cargar serie temporal');
  return resp.json();
}

export async function fetchPipelineStatus(): Promise<PipelineSummary> {
  const resp = await fetch(`${API_BASE}/api/pipeline/status`, { headers: getAuthHeaders() });
  if (resp.status === 401) {
    clearSession();
    window.location.reload();
  }
  if (!resp.ok) throw new Error('Error al cargar estado del pipeline');
  return resp.json();
}

export async function fetchReports(): Promise<ReportItem[]> {
  const resp = await fetch(`${API_BASE}/api/reports`, { headers: getAuthHeaders() });
  if (resp.status === 401) {
    clearSession();
    window.location.reload();
  }
  if (!resp.ok) throw new Error('Error al cargar reportes de IA');
  return resp.json();
}

export async function fetchAnomalies(): Promise<AnomalyItem[]> {
  const resp = await fetch(`${API_BASE}/api/reports/anomalies`, { headers: getAuthHeaders() });
  if (resp.status === 401) {
    clearSession();
    window.location.reload();
  }
  if (!resp.ok) throw new Error('Error al cargar anomalías');
  return resp.json();
}

export async function fetchQuarantine(): Promise<QuarantineItem[]> {
  const resp = await fetch(`${API_BASE}/api/quality/quarantine`, { headers: getAuthHeaders() });
  if (resp.status === 401) {
    clearSession();
    window.location.reload();
  }
  if (resp.status === 403) {
    throw new Error('Permiso denegado: solo administradores pueden ver registros en cuarentena');
  }
  if (!resp.ok) throw new Error('Error al cargar registros en cuarentena');
  return resp.json();
}

export async function regenerateAIReport() {
  const resp = await fetch(`${API_BASE}/api/admin/reports/regenerate`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (resp.status === 403) {
    throw new Error('Permiso denegado: solo administradores pueden regenerar el reporte');
  }
  if (!resp.ok) throw new Error('Error solicitando regeneración de reporte');
  return resp.json();
}

export async function triggerAdminBackfill(daysBack: number, minMagnitude: number) {
  const resp = await fetch(`${API_BASE}/api/admin/backfill`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ days_back: daysBack, min_magnitude: minMagnitude }),
  });
  if (resp.status === 403) {
    throw new Error('Permiso denegado: solo los administradores pueden lanzar backfills');
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Error disparando backfill' }));
    throw new Error(err.detail || 'Fallo al disparar backfill');
  }
  return resp.json();
}

export async function downloadExport(format: 'csv' | 'pdf', minMag?: number) {
  const session = getStoredSession();
  const q = new URLSearchParams({ format, limit: '200' });
  if (minMag !== undefined && minMag !== null) q.append('min_mag', minMag.toString());

  const resp = await fetch(`${API_BASE}/api/reports/export?${q.toString()}`, {
    headers: {
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
  });

  if (!resp.ok) throw new Error(`Fallo en exportación a ${format.toUpperCase()}`);

  const blob = await resp.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sismowatch_report_${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function sendChatMessage(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<import('./types').ChatResponse> {
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message, history }),
  });

  if (resp.status === 401) {
    clearSession();
    window.location.reload();
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Error al comunicarse con SismoBot' }));
    throw new Error(err.detail || 'Fallo en la comunicación con SismoBot');
  }

  return resp.json();
}
