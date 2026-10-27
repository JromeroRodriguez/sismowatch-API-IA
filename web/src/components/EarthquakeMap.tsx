import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Earthquake } from '../types';
import { RotateCcw, ExternalLink, Waves, X } from 'lucide-react';

interface EarthquakeMapProps {
  events: Earthquake[];
  selectedEvent: Earthquake | null;
  onSelectEvent: (event: Earthquake) => void;
  loading?: boolean;
}

type BaseMapType = 'dark' | 'satellite';

const BASEMAP_TILES: Record<BaseMapType, { url: string; attribution: string; subdomains?: string[] }> = {
  dark: {
    // ESRI World Dark Gray Base - Clean, high contrast cartography
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  },
  satellite: {
    // ESRI World Imagery - High-resolution satellite view
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
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

  // 1. Initialize Leaflet Map once with Dark theme
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

    // Add boundaries and reference labels for dark map
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

  // 2. Switch Basemap Layer dynamically (Oscuro / Satelite)
  const switchBaseMap = (type: BaseMapType) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Remove existing tile layer and reference layer
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
      subdomains: cfg.subdomains || ['a', 'b', 'c'],
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
      let color = '#10B981'; // Green: < 3.0
      let radius = 5;

      if (mag >= 6.0) {
        color = '#EF4444'; // Red: >= 6.0
        radius = 12;
      } else if (mag >= 4.5) {
        color = '#F97316'; // Orange: 4.5 - 5.9
        radius = 9;
      } else if (mag >= 3.0) {
        color = '#F59E0B'; // Amber: 3.0 - 4.4
        radius = 7;
      }

      const isSelected = activeEvent?.id === ev.id;

      const marker = L.circleMarker([ev.latitude, ev.longitude], {
        radius: isSelected ? radius + 4 : radius,
        fillColor: color,
        fillOpacity: isSelected ? 0.95 : 0.75,
        color: isSelected ? '#FFFFFF' : color,
        weight: isSelected ? 2.5 : 1,
      });

      marker.bindTooltip(
        `<strong>${ev.place || 'Sismo'}</strong><br/>Mag: <strong>${mag.toFixed(1)} Mw</strong> • Prof: ${ev.depth_km} km`,
        { direction: 'top' }
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
    <div className="relative rounded-xl overflow-hidden bg-white border border-slate-200 shadow-xs flex flex-col h-[520px]">
      
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 z-20">
        
        {/* Title & Stats */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Mapa Sísmico Global en Tiempo Real
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              {loading ? 'Cargando sismos...' : `${events.length} sismos en la capa Gold ploteados`}
            </p>
          </div>
        </div>

        {/* Basemap Switcher & Actions */}
        <div className="flex items-center space-x-2.5">
          
          {/* Layer Selector: Only Oscuro and Satelite */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => switchBaseMap('dark')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                currentBaseMap === 'dark'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Oscuro
            </button>
            <button
              onClick={() => switchBaseMap('satellite')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                currentBaseMap === 'satellite'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Satélite
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetView}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 transition shadow-xs"
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
      <div className="absolute top-16 left-4 z-20 hidden sm:flex items-center space-x-3 text-xs font-mono text-slate-700 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>&lt; 3.0</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>3.0 - 4.4</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
          <span>4.5 - 5.9</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
          <span className="font-bold text-red-600">&ge; 6.0 Mw</span>
        </span>
      </div>

      {/* Selected Event Floating Detail Card */}
      {activeEvent && (
        <div className="absolute bottom-4 left-4 z-30 max-w-sm rounded-xl bg-white border border-slate-200 p-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono text-xs font-bold border border-blue-200">
                {activeEvent.mag?.toFixed(1)} Mw
              </span>
              {activeEvent.tsunami === 1 && (
                <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-mono text-xs font-bold border border-sky-200 flex items-center space-x-1">
                  <Waves className="w-3 h-3" />
                  <span>TSUNAMI</span>
                </span>
              )}
            </div>
            <button
              onClick={() => setActiveEvent(null)}
              aria-label="Cerrar detalle de sismo"
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h4 className="text-sm font-bold text-slate-900 mt-2 leading-snug">
            {activeEvent.place || 'Ubicación no especificada'}
          </h4>

          <div className="grid grid-cols-2 gap-2 mt-2 text-xs font-mono text-slate-600 border-t border-slate-100 pt-2">
            <div>
              <span className="text-slate-400 block text-[11px]">Profundidad:</span>
              <span className="font-semibold text-slate-800">{activeEvent.depth_km} km</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Coordenadas:</span>
              <span className="font-semibold text-slate-800">
                {activeEvent.latitude.toFixed(2)}°, {activeEvent.longitude.toFixed(2)}°
              </span>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 font-mono">
            {new Date(activeEvent.time).toUTCString()}
          </div>

          {activeEvent.url && (
            <a
              href={activeEvent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center space-x-1.5 w-full py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition"
            >
              <span>Ver ficha técnica en USGS</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

    </div>
  );
};
