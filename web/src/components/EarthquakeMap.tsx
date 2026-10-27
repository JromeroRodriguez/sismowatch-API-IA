import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Earthquake } from '../types';
import { RotateCcw, ExternalLink, Waves, Layers } from 'lucide-react';

interface EarthquakeMapProps {
  events: Earthquake[];
  selectedEvent: Earthquake | null;
  onSelectEvent: (event: Earthquake) => void;
  loading?: boolean;
}

type BaseMapType = 'dark' | 'satellite' | 'osm';

const BASEMAP_TILES: Record<BaseMapType, { url: string; attribution: string; subdomains?: string[] }> = {
  dark: {
    // ESRI World Dark Gray Base - 100% Free, NO API Key, No Watermark, Crisp Dark Theme
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  },
  satellite: {
    // ESRI World Imagery - High-res real satellite photography
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
  },
  osm: {
    // OpenStreetMap Standard - Community open cartography
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: ['a', 'b', 'c'],
  },
};

export const EarthquakeMap: React.FC<EarthquakeMapProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  loading = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const referenceLayerRef = useRef<L.TileLayer | null>(null);

  const [activeEvent, setActiveEvent] = useState<Earthquake | null>(selectedEvent);
  const [currentBaseMap, setCurrentBaseMap] = useState<BaseMapType>('dark');

  useEffect(() => {
    setActiveEvent(selectedEvent);
  }, [selectedEvent]);

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1.8,
      maxBounds: [[-85, -180], [85, 180]],
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial Base Tiles (ESRI Dark Gray)
    const baseConfig = BASEMAP_TILES['dark'];
    const baseLayer = L.tileLayer(baseConfig.url, {
      attribution: baseConfig.attribution,
      maxZoom: 18,
    }).addTo(map);
    activeTileLayerRef.current = baseLayer;

    // Add subtle boundaries and country labels for dark map
    const refLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, opacity: 0.8 }
    ).addTo(map);
    referenceLayerRef.current = refLayer;

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Recalculate container dimensions after render
    const timer1 = setTimeout(() => map.invalidateSize(), 150);
    const timer2 = setTimeout(() => map.invalidateSize(), 600);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Switch Basemap Layer dynamically
  const switchBaseMap = (type: BaseMapType) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Remove existing tile layer
    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }
    if (referenceLayerRef.current) {
      map.removeLayer(referenceLayerRef.current);
      referenceLayerRef.current = null;
    }

    const cfg = BASEMAP_TILES[type];
    const newBase = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      subdomains: cfg.subdomains || 'abc',
      maxZoom: 18,
    }).addTo(map);

    // Send tile layer to back so earthquake markers stay on top
    newBase.bringToBack();
    activeTileLayerRef.current = newBase;

    // If dark mode, add reference boundaries
    if (type === 'dark') {
      const ref = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18, opacity: 0.8 }
      ).addTo(map);
      ref.bringToBack();
      newBase.bringToBack();
      referenceLayerRef.current = ref;
    }

    setCurrentBaseMap(type);
  };

  // 3. Render Earthquake Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    layerGroupRef.current.clearLayers();

    events.forEach((ev) => {
      if (typeof ev.latitude !== 'number' || typeof ev.longitude !== 'number') return;

      const mag = ev.mag || 0;
      let color = '#10b981'; // Green: < 3.0
      let radius = 5;

      if (mag >= 6.0) {
        color = '#ef4444'; // Red: >= 6.0
        radius = 13;
      } else if (mag >= 4.5) {
        color = '#f97316'; // Orange: 4.5 - 5.9
        radius = 9;
      } else if (mag >= 3.0) {
        color = '#f59e0b'; // Amber: 3.0 - 4.4
        radius = 7;
      }

      const isSelected = activeEvent?.id === ev.id;

      const marker = L.circleMarker([ev.latitude, ev.longitude], {
        radius: isSelected ? radius + 5 : radius,
        fillColor: color,
        fillOpacity: isSelected ? 0.95 : 0.75,
        color: isSelected ? '#ffffff' : color,
        weight: isSelected ? 3 : 1.2,
      });

      marker.bindTooltip(
        `<strong>${ev.place || 'Sismo'}</strong><br/>Mag: <strong>${mag.toFixed(1)} Mw</strong> • Prof: ${ev.depth_km} km`,
        { direction: 'top', className: 'leaflet-dark-tooltip' }
      );

      marker.on('click', () => {
        setActiveEvent(ev);
        onSelectEvent(ev);
      });

      marker.addTo(layerGroupRef.current!);
    });

    if (activeEvent && mapInstanceRef.current) {
      mapInstanceRef.current.setView([activeEvent.latitude, activeEvent.longitude], 6, {
        animate: true,
      });
    }
  }, [events, activeEvent, onSelectEvent]);

  const handleResetView = () => {
    setActiveEvent(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([20, 0], 2, { animate: true });
      mapInstanceRef.current.invalidateSize();
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl flex flex-col h-[520px]">
      
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-slate-900/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 z-20">
        
        {/* Title & Stats */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shadow-glow-amber">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Mapa Sísmico Global en Tiempo Real
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              {loading ? 'Cargando sismos...' : `${events.length} sismos en la capa Gold ploteados`}
            </p>
          </div>
        </div>

        {/* Basemap Switcher & Actions */}
        <div className="flex items-center space-x-3">
          
          {/* Layer Selector */}
          <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-white/10 text-xs font-semibold">
            <button
              onClick={() => switchBaseMap('dark')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currentBaseMap === 'dark'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌙 Oscuro
            </button>
            <button
              onClick={() => switchBaseMap('satellite')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currentBaseMap === 'satellite'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🛰️ Satélite
            </button>
            <button
              onClick={() => switchBaseMap('osm')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currentBaseMap === 'osm'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🗺️ Calles
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetView}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
            title="Centrar vista global"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Centrar</span>
          </button>
        </div>
      </div>

      {/* Map DOM Container */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', minHeight: '440px' }}
        className="flex-1 z-10 bg-slate-950"
      />

      {/* Magnitude Legend Bar */}
      <div className="absolute top-16 left-4 z-20 hidden sm:flex items-center space-x-3 text-xs font-mono text-slate-300 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg">
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-glow-emerald"></span>
          <span>&lt; 3.0</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-glow-amber"></span>
          <span>3.0 - 4.4</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
          <span>4.5 - 5.9</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-glow-rose"></span>
          <span className="font-bold text-rose-300">&ge; 6.0 Mw</span>
        </span>
      </div>

      {/* Selected Event Floating Detail Card */}
      {activeEvent && (
        <div className="absolute bottom-4 left-4 z-30 max-w-sm rounded-xl glass-panel border border-amber-500/40 p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-xs font-bold border border-amber-500/30">
                {activeEvent.mag?.toFixed(1)} Mw
              </span>
              {activeEvent.tsunami === 1 && (
                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono text-xs font-bold border border-sky-500/30 flex items-center space-x-1">
                  <Waves className="w-3 h-3" />
                  <span>TSUNAMI</span>
                </span>
              )}
            </div>
            <button
              onClick={() => setActiveEvent(null)}
              className="text-slate-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>

          <h4 className="text-sm font-bold text-white mt-2 leading-snug">
            {activeEvent.place || 'Ubicación no especificada'}
          </h4>

          <div className="grid grid-cols-2 gap-2 mt-2 text-xs font-mono text-slate-300 border-t border-white/5 pt-2">
            <div>
              <span className="text-slate-500 block">Profundidad:</span>
              <span className="font-semibold text-slate-200">{activeEvent.depth_km} km</span>
            </div>
            <div>
              <span className="text-slate-500 block">Coordenadas:</span>
              <span className="font-semibold text-slate-200">
                {activeEvent.latitude.toFixed(2)}°, {activeEvent.longitude.toFixed(2)}°
              </span>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            {new Date(activeEvent.time).toUTCString()}
          </div>

          {activeEvent.url && (
            <a
              href={activeEvent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center space-x-1.5 w-full py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all"
            >
              <span>Ver ficha técnica en USGS</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

    </div>
  );
};
