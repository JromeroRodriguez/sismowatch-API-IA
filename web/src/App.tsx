import React, { useState, useEffect, useCallback } from 'react';
import { getStoredSession, clearSession, fetchKPIs, fetchEvents, fetchTimeSeries, fetchPipelineStatus, fetchReports, fetchAnomalies } from './api';
import { UserSession, KPIsResponse, Earthquake, TimeSeriesPoint, PipelineSummary, ReportItem, AnomalyItem } from './types';
import { Header } from './components/Header';
import { KpiCards } from './components/KpiCards';
import { EarthquakeMap } from './components/EarthquakeMap';
import { ActivityCharts } from './components/ActivityCharts';
import { EventsTable } from './components/EventsTable';
import { PipelineModal } from './components/PipelineModal';
import { AIReportsView } from './components/AIReportsView';
import { AdminBackfillModal } from './components/AdminBackfillModal';
import { LoginView } from './components/LoginView';
import { AlertCircle, Bell } from 'lucide-react';

export const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(getStoredSession());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'pipeline' | 'ai-reports'>('dashboard');

  // Dashboard Data State
  const [kpis, setKpis] = useState<KPIsResponse | null>(null);
  const [events, setEvents] = useState<Earthquake[]>([]);
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);

  // Interaction State
  const [selectedEvent, setSelectedEvent] = useState<Earthquake | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minMagFilter, setMinMagFilter] = useState<number | undefined>(undefined);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // SSE Live State
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [newEarthquakeToast, setNewEarthquakeToast] = useState<Earthquake | null>(null);

  // Admin Modal State
  const [isBackfillOpen, setIsBackfillOpen] = useState<boolean>(false);

  // Data Loading Function
  const loadAllData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setIsRefreshing(true);
    setError(null);

    try {
      const [kpiRes, eventsRes, tsRes, pipeRes, repRes, anomRes] = await Promise.all([
        fetchKPIs(),
        fetchEvents({
          page: currentPage,
          pageSize,
          minMag: minMagFilter,
          search: searchQuery,
        }),
        fetchTimeSeries(7, 'hour'),
        fetchPipelineStatus(),
        fetchReports(),
        fetchAnomalies(),
      ]);

      setKpis(kpiRes);
      setEvents(eventsRes.items);
      setTotalEvents(eventsRes.total);
      setTimeSeries(tsRes);
      setPipeline(pipeRes);
      setReports(repRes);
      setAnomalies(anomRes);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Error cargando datos de la plataforma');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, pageSize, minMagFilter, searchQuery]);

  // Initial load and filter change trigger
  useEffect(() => {
    if (session) {
      loadAllData();
    }
  }, [session, loadAllData]);

  // Setup Server-Sent Events (SSE) stream
  useEffect(() => {
    if (!session?.token) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any;

    const connectSSE = () => {
      try {
        eventSource = new EventSource(`/api/stream?token=${encodeURIComponent(session.token)}`);

        eventSource.onopen = () => {
          setSseConnected(true);
        };

        // Listen for new earthquake notifications from backend
        eventSource.addEventListener('earthquake', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'new_earthquake' && data.event) {
              const newEv: Earthquake = data.event;
              setNewEarthquakeToast(newEv);
              setLastUpdated(new Date().toLocaleTimeString());

              // Prepend to event list if not already present
              setEvents((prev) => {
                if (prev.some((item) => item.id === newEv.id)) return prev;
                return [newEv, ...prev];
              });

              // Increment KPI count
              setKpis((prev) =>
                prev ? { ...prev, total_events_24h: prev.total_events_24h + 1, total_events_gold: prev.total_events_gold + 1 } : null
              );

              // Auto-dismiss toast after 6s
              setTimeout(() => {
                setNewEarthquakeToast((curr) => (curr?.id === newEv.id ? null : curr));
              }, 6000);
            }
          } catch (err) {
            console.error('Error parsing SSE event:', err);
          }
        });

        // Listen for keepalive pings
        eventSource.addEventListener('ping', () => {
          setSseConnected(true);
        });

        eventSource.onerror = () => {
          setSseConnected(false);
          if (eventSource) {
            eventSource.close();
          }
          // Reconnect with backoff
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        setSseConnected(false);
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      clearTimeout(reconnectTimeout);
    };
  }, [session]);

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  // If not logged in, show Login View
  if (!session) {
    return <LoginView onLoginSuccess={(sess) => setSession(sess)} />;
  }

  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <Header
        session={session}
        onLogout={handleLogout}
        sseConnected={sseConnected}
        lastUpdated={lastUpdated}
        onRefresh={() => loadAllData(true)}
        isRefreshing={isRefreshing}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBackfill={session.role === 'admin' ? () => setIsBackfillOpen(true) : undefined}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Error Alert Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadAllData()}
              className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-medium transition"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Live Earthquake Floating Toast Notification */}
        {newEarthquakeToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-bounce bg-slate-900 border border-amber-500/40 rounded-xl p-4 shadow-2xl max-w-sm flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1">
                <span>Nuevo Sismo Registrado (SSE)</span>
              </div>
              <p className="text-xs text-white font-medium mt-0.5">{newEarthquakeToast.place}</p>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                Mag: <b className="text-amber-400">{newEarthquakeToast.mag?.toFixed(1)} Mw</b> &bull; Prof: {newEarthquakeToast.depth_km} km
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top KPI Cards */}
            <KpiCards kpis={kpis} loading={loading} />

            {/* Map & Timeline Grid */}
            <div className="grid grid-cols-1 gap-6">
              <EarthquakeMap
                events={events}
                selectedEvent={selectedEvent}
                onSelectEvent={(ev) => setSelectedEvent(ev)}
              />
            </div>

            {/* Activity Charts & Magnitude Breakdown */}
            <ActivityCharts timeSeries={timeSeries} earthquakes={events} />
          </div>
        )}

        {/* TAB 2: EVENTS & EXPORTS */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <EventsTable
              events={events}
              total={totalEvents}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
              }}
              minMagFilter={minMagFilter}
              onMinMagChange={(m) => {
                setMinMagFilter(m);
                setCurrentPage(1);
              }}
              onSelectEvent={(ev) => {
                setSelectedEvent(ev);
                setActiveTab('dashboard');
              }}
              loading={loading}
            />
          </div>
        )}

        {/* TAB 3: AI REPORTS & ANOMALIES */}
        {activeTab === 'ai-reports' && (
          <div className="space-y-6">
            <AIReportsView
              reports={reports}
              anomalies={anomalies}
              session={session}
              onRefresh={() => loadAllData(true)}
              loading={loading}
            />
          </div>
        )}

        {/* TAB 4: PIPELINE & CALIDAD */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            <PipelineModal pipeline={pipeline} loading={loading} />
          </div>
        )}

      </main>

      {/* Admin Backfill Modal */}
      {session.role === 'admin' && (
        <AdminBackfillModal
          isOpen={isBackfillOpen}
          onClose={() => setIsBackfillOpen(false)}
          onSuccess={() => {
            setIsBackfillOpen(false);
            loadAllData(true);
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
        SismoWatch &bull; Arquitectura Medallion (Bronze / Silver / Gold) &bull; Pandera Quality Gate &bull; USGS Real-Time
      </footer>

    </div>
  );
};
export default App;
