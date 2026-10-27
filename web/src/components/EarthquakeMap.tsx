import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Earthquake } from '../types';

interface EarthquakeMapProps {
  events: Earthquake[];
  selectedEvent: Earthquake | null;
  onSelectEvent: (event: Earthquake) => void;
}

export const EarthquakeMap: React.FC<EarthquakeMapProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1.5,
      maxBounds: [[-85, -180], [85, 180]],
    });

    // DarkMatter tiles by CartoDB
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers when events change
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    layerGroupRef.current.clearLayers();

    events.forEach((ev) => {
      if (typeof ev.latitude !== 'number' || typeof ev.longitude !== 'number') return;

      const mag = ev.mag || 0;
      let color = '#10b981'; // green for < 3
      let radius = 5;

      if (mag >= 6.0) {
        color = '#ef4444'; // Red
        radius = 12;
      } else if (mag >= 4.5) {
        color = '#f97316'; // Orange
        radius = 9;
      } else if (mag >= 3.0) {
        color = '#f59e0b'; // Amber
        radius = 7;
      }

      const isSelected = selectedEvent?.id === ev.id;

      const marker = L.circleMarker([ev.latitude, ev.longitude], {
        radius: isSelected ? radius + 4 : radius,
        fillColor: color,
        fillOpacity: isSelected ? 0.9 : 0.65,
        color: isSelected ? '#ffffff' : color,
        weight: isSelected ? 2.5 : 1,
      });

      const popupContent = `
        <div style="font-family: sans-serif; font-size: 12px; color: #0f172a; padding: 4px;">
          <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">${ev.place || 'Sismo sin nombre'}</div>
          <div><b>Magnitud:</b> <span style="color: ${color}; font-weight: bold;">${mag.toFixed(1)} Mw</span></div>
          <div><b>Profundidad:</b> ${ev.depth_km ? ev.depth_km.toFixed(1) : '-'} km</div>
          <div><b>Fecha UTC:</b> ${new Date(ev.time).toUTCString()}</div>
          ${ev.tsunami ? '<div style="color: #0284c7; font-weight: bold; margin-top: 4px;">🌊 Alerta de Tsunami</div>' : ''}
          ${ev.url ? `<div style="margin-top: 6px;"><a href="${ev.url}" target="_blank" rel="noopener noreferrer" style="color: #d97706; text-decoration: underline;">Ver ficha USGS &rarr;</a></div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => onSelectEvent(ev));

      marker.addTo(layerGroupRef.current!);
    });

    // If selected event changed, pan to it
    if (selectedEvent && mapInstanceRef.current) {
      mapInstanceRef.current.setView([selectedEvent.latitude, selectedEvent.longitude], 5, {
        animate: true,
      });
    }
  }, [events, selectedEvent, onSelectEvent]);

  return (
    <div className="relative rounded-xl overflow-hidden glass-card shadow-lg flex flex-col h-[480px]">
      {/* Header bar */}
      <div className="px-5 py-3 glass-panel border-b border-white/10 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-glow-amber animate-pulse motion-reduce:animate-none"></span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-sans">
            Distribución Geoespacial ({events.length} sismos detectados)
          </h3>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center space-x-4 text-xs font-mono text-slate-350">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-glow-emerald"></span>
            <span>&lt; 3.0 Mw</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-glow-amber"></span>
            <span>3.0 - 4.4 Mw</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
            <span>4.5 - 5.9 Mw</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-glow-rose"></span>
            <span className="font-bold text-rose-300">&ge; 6.0 Mw</span>
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full flex-1 z-0" aria-label="Mapa interactivo de sismos globales" role="region" />
    </div>
  );
};
