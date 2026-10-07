import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from '../utils/leafletCluster.ts';
import { RailwayPoint, RailwayPointCategory, TakyidatSpeedRestriction, RailwayParcel } from '../types.ts';
import { CategoryColorConfig, DEFAULT_CATEGORY_COLORS, formatKmDisplay } from '../utils/categoryColors.ts';
import {
  getDistanceMeters,
  formatMeterDistance,
  calculatePolylineMeasurements,
  calculateLiveChainage,
  LatLngPoint,
} from '../utils/measurement.ts';
import { parseKmToNumber } from '../utils/kmUtils.ts';
import { calculateParcelCenter } from '../utils/parcelUtils.ts';
import { Layers, Locate, Maximize2, Plus, Train, Ruler, RotateCcw, Undo2, Check, RotateCw, Globe, ExternalLink, MapPin, Crosshair, Gauge, AlertTriangle, X, Landmark, Sparkles } from 'lucide-react';

interface RailwayMapProps {
  points: RailwayPoint[];
  selectedPoint: RailwayPoint | null;
  onSelectPoint: (point: RailwayPoint) => void;
  onMapClickAdd?: (lat: number, lng: number) => void;
  isAddMode: boolean;
  setIsAddMode: (active: boolean) => void;
  categoryColors?: Record<RailwayPointCategory, CategoryColorConfig>;
  initialMeasurePoint?: LatLngPoint | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  takyidatRestrictions?: TakyidatSpeedRestriction[];
  onOpenTakyidat?: () => void;
  railwayParcels?: RailwayParcel[];
  onOpenParcels?: () => void;
  isLivePointPickMode?: boolean;
  onPickLivePoint?: (lat: number, lng: number) => void;
  onCancelLivePointPick?: () => void;
  isTakyidatPickMode?: 'start' | 'end' | 'both' | 'both-step2' | null;
  onPickTakyidatPoint?: (lat: number, lng: number, pointKm?: string, pointTitle?: string, lineName?: string) => void;
  onCancelTakyidatPick?: () => void;
  liveGpsCoords?: { lat: number; lng: number } | null;
}

function createMarkerIcon(
  point: RailwayPoint,
  isSelected: boolean,
  categoryColors: Record<RailwayPointCategory, CategoryColorConfig> = DEFAULT_CATEGORY_COLORS,
  compactMode: boolean = false
) {
  const cat = categoryColors[point.category] || categoryColors.km_marker || DEFAULT_CATEGORY_COLORS.km_marker;
  const cleanKm = formatKmDisplay(point.kmValue, point.title);
  // Prominently display KM value (e.g. "KM 142+250") or fallback to title or category label
  const displayBadge = cleanKm
    ? (cleanKm.toLowerCase().startsWith('km') ? cleanKm : `KM ${cleanKm}`)
    : (point.title ? point.title.slice(0, 16) : (cat.shortLabel || cat.label));

  if (compactMode && !isSelected) {
    // Elegant, highly-visible railway round shield marker along the tracks
    const html = `
      <div class="relative flex items-center justify-center cursor-pointer transition-transform duration-150 hover:scale-125 notranslate" translate="no" title="${point.title}${cleanKm ? ' • KM ' + cleanKm : ''}">
        <div style="background-color: ${cat.bg}; border-color: ${cat.border};"
             class="w-6 h-6 rounded-full border-2 shadow-md ring-2 ring-white/90 flex items-center justify-center text-white">
          <span class="w-3.5 h-3.5 flex items-center justify-center">${cat.svgIcon}</span>
        </div>
        <div style="border-top-color: ${cat.border};"
             class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-x-3 border-x-transparent border-t-4"></div>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'custom-railway-shield-marker',
      iconSize: [24, 28],
      iconAnchor: [12, 28],
      popupAnchor: [0, -28],
    });
  }

  // Full detailed railway badge (clean highlight without distracting blinking/ping)
  const html = `
    <div class="relative flex items-center justify-center cursor-pointer transition-transform duration-150 notranslate ${
      isSelected ? 'scale-115 z-50' : 'hover:scale-105 z-10'
    }" translate="no">
      ${
        isSelected
          ? `<div class="absolute -inset-1.5 rounded-full ring-2 ring-amber-400 bg-amber-400/30"></div>`
          : ''
      }
      <div style="background-color: ${cat.bg}; border-color: ${
    isSelected ? '#fbbf24' : cat.border
  }; color: ${cat.text || '#ffffff'};"
           class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono font-bold text-xs shadow-md border-2 whitespace-nowrap min-w-max">
        <span class="flex-shrink-0 flex items-center justify-center w-3.5 h-3.5">${cat.svgIcon}</span>
        <span class="tracking-tight text-[11px] font-bold notranslate" translate="no">${displayBadge}</span>
      </div>
      <div style="border-top-color: ${isSelected ? '#fbbf24' : cat.border};"
           class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-6"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-railway-marker',
    iconSize: [110, 32],
    iconAnchor: [55, 32],
    popupAnchor: [0, -32],
  });
}

export const RailwayMap: React.FC<RailwayMapProps> = ({
  points,
  selectedPoint,
  onSelectPoint,
  onMapClickAdd,
  isAddMode,
  setIsAddMode,
  categoryColors = DEFAULT_CATEGORY_COLORS,
  initialMeasurePoint = null,
  onRefresh,
  isRefreshing,
  takyidatRestrictions = [],
  onOpenTakyidat,
  railwayParcels = [],
  onOpenParcels,
  isLivePointPickMode = false,
  onPickLivePoint,
  onCancelLivePointPick,
  isTakyidatPickMode = null,
  onPickTakyidatPoint,
  onCancelTakyidatPick,
  liveGpsCoords,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerInstancesMapRef = useRef<Map<string, L.Marker>>(new Map());
  const railwayLayerRef = useRef<L.TileLayer | null>(null);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const takyidatLayerRef = useRef<L.LayerGroup | null>(null);
  const parcelsLayerRef = useRef<L.LayerGroup | null>(null);

  // Clean Railway Layout State: 'smart' (zoom-adaptive dots when zoomed out, badges when zoomed in) or 'all' (always full badges)
  const [labelMode, setLabelMode] = useState<'smart' | 'all'>(() => {
    try {
      const stored = localStorage.getItem('tcdd_railway_label_mode');
      return (stored === 'all' || stored === 'smart') ? stored : 'smart';
    } catch {
      return 'smart';
    }
  });

  const [currentZoom, setCurrentZoom] = useState<number>(7);

  useEffect(() => {
    try {
      localStorage.setItem('tcdd_railway_label_mode', labelMode);
    } catch {}
  }, [labelMode]);

  const [mapType, setMapType] = useState<'streets' | 'google-earth' | 'google-satellite' | 'esri-satellite'>('google-earth');
  const [showRailwayOverlay, setShowRailwayOverlay] = useState<boolean>(true);
  const [showTakyidatOverlay, setShowTakyidatOverlay] = useState<boolean>(true);
  const [showParcelsOverlay, setShowParcelsOverlay] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Meter & Distance Measurement State
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [measurePoints, setMeasurePoints] = useState<LatLngPoint[]>([]);
  const [hoverPoint, setHoverPoint] = useState<LatLngPoint | null>(null);

  // Refs to eliminate stale closure bugs in map click handlers
  const onSelectPointRef = useRef(onSelectPoint);
  onSelectPointRef.current = onSelectPoint;

  const onOpenTakyidatRef = useRef(onOpenTakyidat);
  onOpenTakyidatRef.current = onOpenTakyidat;

  const isAddModeRef = useRef(isAddMode);
  isAddModeRef.current = isAddMode;

  const onMapClickAddRef = useRef(onMapClickAdd);
  onMapClickAddRef.current = onMapClickAdd;

  const isLivePointPickModeRef = useRef(isLivePointPickMode);
  isLivePointPickModeRef.current = isLivePointPickMode;

  const onPickLivePointRef = useRef(onPickLivePoint);
  onPickLivePointRef.current = onPickLivePoint;

  const isTakyidatPickModeRef = useRef(isTakyidatPickMode);
  isTakyidatPickModeRef.current = isTakyidatPickMode;

  const onPickTakyidatPointRef = useRef(onPickTakyidatPoint);
  onPickTakyidatPointRef.current = onPickTakyidatPoint;

  const isMeasuringRef = useRef(isMeasuring);
  isMeasuringRef.current = isMeasuring;

  const measurePointsRef = useRef(measurePoints);
  measurePointsRef.current = measurePoints;

  // Measurement results including committed points + real-time live cursor point
  const livePoints = useMemo(() => {
    if (!isMeasuring || measurePoints.length === 0) return measurePoints;
    if (hoverPoint) {
      return [...measurePoints, hoverPoint];
    }
    return measurePoints;
  }, [isMeasuring, measurePoints, hoverPoint]);

  const measurementResult = useMemo(() => {
    return calculatePolylineMeasurements(livePoints);
  }, [livePoints]);

  // Live segment distance between last fixed point and mouse position
  const currentLiveSegment = useMemo(() => {
    if (!isMeasuring || measurePoints.length === 0 || !hoverPoint) return null;
    const lastFixed = measurePoints[measurePoints.length - 1];
    const dist = getDistanceMeters(lastFixed, hoverPoint);
    return {
      distance: dist,
      formatted: formatMeterDistance(dist),
    };
  }, [isMeasuring, measurePoints, hoverPoint]);

  // Sync initial measure point if requested by user
  useEffect(() => {
    if (initialMeasurePoint) {
      setIsMeasuring(true);
      setIsAddMode(false);
      setMeasurePoints([initialMeasurePoint]);
    }
  }, [initialMeasurePoint, setIsAddMode]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center around Turkey railway network (e.g. Ankara / Central Anatolia) or first point
    const initialCenter: [number, number] = points.length > 0 ? [points[0].lat, points[0].lng] : [39.7, 32.5];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 7,
      zoomControl: false,
    });

    // Custom zoom control in bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Standard OpenStreetMap base layer
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    // OpenRailwayMap overlay
    const railwayOverlay = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.85,
      attribution: '&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>',
    }).addTo(map);

    const takyidatGroup = L.layerGroup().addTo(map);
    const parcelsGroup = L.layerGroup().addTo(map);
    const measureGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    takyidatLayerRef.current = takyidatGroup;
    parcelsLayerRef.current = parcelsGroup;
    railwayLayerRef.current = railwayOverlay;
    measureLayerRef.current = measureGroup;

    // Map click handler - strictly accesses current values via refs to avoid stale closure
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isTakyidatPickModeRef.current && onPickTakyidatPointRef.current) {
        onPickTakyidatPointRef.current(e.latlng.lat, e.latlng.lng);
        return;
      }

      if (isLivePointPickModeRef.current && onPickLivePointRef.current) {
        onPickLivePointRef.current(e.latlng.lat, e.latlng.lng);
        return;
      }

      if (isMeasuringRef.current) {
        setMeasurePoints((prev) => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
        return;
      }

      if (isAddModeRef.current && onMapClickAddRef.current) {
        onMapClickAddRef.current(e.latlng.lat, e.latlng.lng);
        setIsAddMode(false);
      }
    });

    // Listen to zoom changes to adaptively switch marker compactness
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Real-time mouse movement listener like Google Earth / Maps ruler with requestAnimationFrame throttling
    let hoverRafId: number | null = null;
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (isMeasuringRef.current && measurePointsRef.current.length > 0) {
        if (hoverRafId) cancelAnimationFrame(hoverRafId);
        hoverRafId = requestAnimationFrame(() => {
          setHoverPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }
    });

    map.on('mouseout', () => {
      if (hoverRafId) cancelAnimationFrame(hoverRafId);
      setHoverPoint(null);
    });

    return () => {
      if (hoverRafId) cancelAnimationFrame(hoverRafId);
      try {
        map.remove();
      } catch {}
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      takyidatLayerRef.current = null;
      parcelsLayerRef.current = null;
      measureLayerRef.current = null;
      railwayLayerRef.current = null;
      markerInstancesMapRef.current.clear();
    };
  }, []);

  // Maintain container size with ResizeObserver so map never turns gray on container changes
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Update cursor and invalidate size safely when mode changes without overwriting Leaflet DOM classes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const container = map.getContainer();
    if (container) {
      if (isAddMode || isMeasuring || isLivePointPickMode || !!isTakyidatPickMode) {
        container.style.cursor = 'crosshair';
      } else {
        container.style.cursor = '';
      }
    }

    // Small delay ensures DOM layout is updated
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 50);

    return () => clearTimeout(timer);
  }, [isAddMode, isMeasuring, isLivePointPickMode, isTakyidatPickMode]);

  // Update map layer when mapType changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing base layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer && layer !== railwayLayerRef.current) {
        map.removeLayer(layer);
      }
    });

    if (mapType === 'google-earth') {
      // Google Earth / Hybrid Satellite (Crisp satellite imagery with railway/road/station labels)
      L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 21,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Earth / Harita Verileri',
      }).addTo(map);
    } else if (mapType === 'google-satellite') {
      // Google Earth / Pure Satellite (Crisp satellite imagery without labels)
      L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 21,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Earth / Uydu Görüntüleri',
      }).addTo(map);
    } else if (mapType === 'esri-satellite') {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
        }
      ).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
    }

    // Re-add railway layer if enabled so it stays on top of base tiles
    if (railwayLayerRef.current) {
      if (showRailwayOverlay) {
        railwayLayerRef.current.addTo(map);
      } else {
        map.removeLayer(railwayLayerRef.current);
      }
    }
  }, [mapType, showRailwayOverlay]);

  // Render Measurement Visuals (polyline, numbered pins, segment distance badges + dynamic rubber-band line & live cursor badge)
  useEffect(() => {
    const measureGroup = measureLayerRef.current;
    if (!measureGroup) return;

    measureGroup.clearLayers();

    if (!isMeasuring || measurePoints.length === 0) return;

    // Add numbered circular marker for each committed point
    measurePoints.forEach((pt, index) => {
      const isFirst = index === 0;
      const isLast = index === measurePoints.length - 1 && measurePoints.length > 1;

      const markerHtml = `
        <div class="flex items-center justify-center w-6 h-6 rounded-full text-white font-bold text-xs shadow-lg border-2 border-white ring-2 ${
          isFirst
            ? 'bg-sky-600 ring-sky-400'
            : isLast
            ? 'bg-emerald-600 ring-emerald-400'
            : 'bg-amber-600 ring-amber-400'
        }">
          ${index + 1}
        </div>
      `;

      const icon = L.divIcon({
        html: markerHtml,
        className: 'measure-point-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([pt.lat, pt.lng], { icon, interactive: false }).addTo(measureGroup);
    });

    // Draw solid/dashed line between committed points
    if (measurePoints.length >= 2) {
      const latlngs: [number, number][] = measurePoints.map((p) => [p.lat, p.lng]);

      // Outer glow line
      L.polyline(latlngs, {
        color: '#10b981',
        weight: 6,
        opacity: 0.4,
      }).addTo(measureGroup);

      // Main line
      L.polyline(latlngs, {
        color: '#059669',
        weight: 3.5,
        opacity: 0.95,
      }).addTo(measureGroup);

      // Segment distance badges at each committed segment's midpoint
      for (let i = 0; i < measurePoints.length - 1; i++) {
        const p1 = measurePoints[i];
        const p2 = measurePoints[i + 1];
        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = (p1.lng + p2.lng) / 2;

        const segDist = getDistanceMeters(p1, p2);
        const segFormatted = formatMeterDistance(segDist);

        const badgeHtml = `
          <div class="bg-slate-950/90 text-emerald-300 font-mono font-bold text-[11px] px-2 py-0.5 rounded-md shadow-md border border-emerald-500/50 whitespace-nowrap">
            📏 ${segFormatted.shortText}
          </div>
        `;

        const badgeIcon = L.divIcon({
          html: badgeHtml,
          className: 'measure-segment-badge',
          iconSize: [60, 20],
          iconAnchor: [30, 10],
        });

        L.marker([midLat, midLng], { icon: badgeIcon, interactive: false }).addTo(measureGroup);
      }
    }

    // REAL-TIME DYNAMIC RUBBER-BAND LINE & FLOATING CURSOR BADGE (Google Earth / Google Maps Style)
    // As the mouse moves, the line dynamically extends and the distance increases/decreases in real time!
    if (hoverPoint && measurePoints.length > 0) {
      const lastPoint = measurePoints[measurePoints.length - 1];
      const liveSegmentDist = getDistanceMeters(lastPoint, hoverPoint);
      const liveFormatted = formatMeterDistance(liveSegmentDist);

      // Calculate total distance including this live mouse position
      let totalWithHover = liveSegmentDist;
      for (let i = 0; i < measurePoints.length - 1; i++) {
        totalWithHover += getDistanceMeters(measurePoints[i], measurePoints[i + 1]);
      }
      const totalFormatted = formatMeterDistance(totalWithHover);

      // Live rubber-band line from last point to cursor
      L.polyline(
        [
          [lastPoint.lat, lastPoint.lng],
          [hoverPoint.lat, hoverPoint.lng],
        ],
        {
          color: '#38bdf8', // Sky blue like Google Maps
          weight: 2.5,
          dashArray: '5, 6',
          opacity: 0.9,
        }
      ).addTo(measureGroup);

      // Live target crosshair circle at cursor position
      const cursorTargetHtml = `
        <div class="relative flex items-center justify-center pointer-events-none">
          <div class="w-4 h-4 rounded-full border-2 border-sky-400 bg-sky-500/30 animate-pulse"></div>
          <div class="w-1.5 h-1.5 rounded-full bg-white shadow-xs"></div>
        </div>
      `;
      const cursorTargetIcon = L.divIcon({
        html: cursorTargetHtml,
        className: 'measure-cursor-target',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([hoverPoint.lat, hoverPoint.lng], { icon: cursorTargetIcon, interactive: false }).addTo(measureGroup);

      // Real-time floating distance badge right next to the mouse cursor
      const cursorTooltipHtml = `
        <div class="bg-slate-900/95 text-white px-2.5 py-1 rounded-lg shadow-xl border border-sky-400/80 font-mono text-[11px] whitespace-nowrap pointer-events-none flex flex-col gap-0.5 leading-tight">
          <div class="flex items-center gap-1.5 font-bold text-sky-300">
            <span class="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
            <span>${liveFormatted.shortText}</span>
          </div>
          ${
            measurePoints.length > 1
              ? `<div class="text-[10px] text-emerald-400 border-t border-slate-700 pt-0.5">Toplam: ${totalFormatted.shortText}</div>`
              : ''
          }
        </div>
      `;
      const cursorTooltipIcon = L.divIcon({
        html: cursorTooltipHtml,
        className: 'measure-cursor-tooltip',
        iconSize: [110, 36],
        iconAnchor: [-14, 18], // slightly offset to the right and down of cursor
      });
      L.marker([hoverPoint.lat, hoverPoint.lng], { icon: cursorTooltipIcon, interactive: false }).addTo(measureGroup);
    }
  }, [measurePoints, hoverPoint, isMeasuring]);

  const isCompact = labelMode === 'smart' && currentZoom < 13;

  // Auto-fit bounds on first load when points are loaded
  const hasAutoFittedRef = useRef<boolean>(false);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || points.length === 0 || hasAutoFittedRef.current) return;

    try {
      const validPoints = points.filter(
        (p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0
      );
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        hasAutoFittedRef.current = true;
      }
    } catch {}
  }, [points]);

  // 1. Update & Render Markers on the map (Clean Flat Layer without confusing clusters)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let layer = markersLayerRef.current;
    if (!layer || !map.hasLayer(layer)) {
      if (layer) {
        try {
          layer.clearLayers();
        } catch {}
      }
      layer = L.layerGroup().addTo(map);
      markersLayerRef.current = layer;
    }

    layer.clearLayers();
    markerInstancesMapRef.current.clear();

    const selectedId = selectedPoint?.id;

    points.forEach((point) => {
      const isSelected = selectedId === point.id;
      const icon = createMarkerIcon(point, isSelected, categoryColors, isCompact);

      const marker = L.marker([point.lat, point.lng], { icon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (isTakyidatPickModeRef.current && onPickTakyidatPointRef.current) {
          onPickTakyidatPointRef.current(point.lat, point.lng, point.kmValue, point.title, point.lineName);
          return;
        }
        if (isLivePointPickModeRef.current && onPickLivePointRef.current) {
          onPickLivePointRef.current(point.lat, point.lng);
          return;
        }
        if (isMeasuringRef.current) {
          setMeasurePoints((prev) => [...prev, { lat: point.lat, lng: point.lng }]);
          return;
        }
        onSelectPointRef.current(point);
      });

      const cleanKm = formatKmDisplay(point.kmValue, point.title);
      marker.bindTooltip(
        `
        <div class="text-xs font-sans notranslate p-0.5" translate="no">
          <div class="font-bold text-slate-900" style="${point.titleTextStyle?.color ? `color: ${point.titleTextStyle.color};` : ''}${point.titleTextStyle?.fontStyle === 'italic' ? 'font-style: italic;' : ''}${point.titleTextStyle?.textDecoration === 'underline' ? 'text-decoration: underline;' : ''}">${point.title}</div>
          <div class="text-sky-700 font-mono font-bold mt-0.5">📍 KM: ${cleanKm || 'Belirtilmemiş'}</div>
          <div class="text-slate-500 text-[11px]">${point.lineName}${point.locationDesc ? ` • ${point.locationDesc}` : ''}</div>
        </div>
      `,
        { direction: 'top', offset: [0, isCompact ? -12 : -32] }
      );

      markerInstancesMapRef.current.set(point.id, marker);
      layer.addLayer(marker);
    });

    if (selectedId && markerInstancesMapRef.current.has(selectedId)) {
      const curMarker = markerInstancesMapRef.current.get(selectedId)!;
      curMarker.openTooltip();
    }
  }, [points, categoryColors, isCompact]);

  // 2. High-performance Isolated Selected Marker Highlight (0ms latency, zero marker recreation)
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevSelectedIdRef.current;
    const currentId = selectedPoint?.id || null;
    if (prevId === currentId) return;

    if (prevId && markerInstancesMapRef.current.has(prevId)) {
      const prevMarker = markerInstancesMapRef.current.get(prevId)!;
      const prevPt = points.find((p) => p.id === prevId);
      if (prevPt) {
        prevMarker.setIcon(createMarkerIcon(prevPt, false, categoryColors, isCompact));
      }
    }

    if (currentId && markerInstancesMapRef.current.has(currentId)) {
      const curMarker = markerInstancesMapRef.current.get(currentId)!;
      const curPt = points.find((p) => p.id === currentId);
      if (curPt) {
        curMarker.setIcon(createMarkerIcon(curPt, true, categoryColors, false));
        curMarker.openTooltip();
        if (mapInstanceRef.current) {
          const center = mapInstanceRef.current.getCenter();
          const dist = Math.hypot(center.lat - curPt.lat, center.lng - curPt.lng);
          if (dist > 0.05) {
            mapInstanceRef.current.panTo([curPt.lat, curPt.lng], { animate: true });
          }
        }
      }
    }

    prevSelectedIdRef.current = currentId;
  }, [selectedPoint, points, categoryColors, isCompact]);

  // Render Takyidat (Speed Restriction Segments & Warning Badges) on the Railway Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const takyidatGroup = takyidatLayerRef.current;
    if (!map || !takyidatGroup) return;

    takyidatGroup.clearLayers();
    if (!showTakyidatOverlay || takyidatRestrictions.length === 0) return;

    // Helper: Find coordinates for a given KM by searching existing points or interpolating
    const pointsWithKm = points
      .map((p) => ({
        point: p,
        kmNum: parseKmToNumber(p.kmValue, p.title),
      }))
      .filter((item): item is { point: RailwayPoint; kmNum: number } => item.kmNum !== null)
      .sort((a, b) => a.kmNum - b.kmNum);

    const getCoordForKm = (kmNum: number, lineName?: string): [number, number] | null => {
      const linePts = lineName && lineName !== 'Tüm Hatlar'
        ? pointsWithKm.filter((item) => !item.point.lineName || item.point.lineName === lineName)
        : pointsWithKm;

      const ptsToUse = linePts.length > 0 ? linePts : pointsWithKm;
      if (ptsToUse.length === 0) return null;

      // Exact match
      const exact = ptsToUse.find((p) => Math.abs(p.kmNum - kmNum) < 0.05);
      if (exact) return [exact.point.lat, exact.point.lng];

      // Find surrounding points to interpolate
      let before = ptsToUse[0];
      let after = ptsToUse[ptsToUse.length - 1];

      for (let i = 0; i < ptsToUse.length - 1; i++) {
        if (ptsToUse[i].kmNum <= kmNum && ptsToUse[i + 1].kmNum >= kmNum) {
          before = ptsToUse[i];
          after = ptsToUse[i + 1];
          break;
        }
      }

      if (before.kmNum === after.kmNum || before.kmNum === kmNum) {
        return [before.point.lat, before.point.lng];
      }

      const ratio = Math.max(0, Math.min(1, (kmNum - before.kmNum) / (after.kmNum - before.kmNum)));
      const lat = before.point.lat + (after.point.lat - before.point.lat) * ratio;
      const lng = before.point.lng + (after.point.lng - before.point.lng) * ratio;
      return [lat, lng];
    };

    takyidatRestrictions.forEach((restriction) => {
      const isLifted = restriction.status === 'lifted';
      const isPlanned = restriction.status === 'planned';

      const startCoord = getCoordForKm(restriction.startKmNum, restriction.lineName);
      const endCoord = getCoordForKm(restriction.endKmNum, restriction.lineName);

      if (!startCoord || !endCoord) return;

      // Gather intermediate points in this KM range to follow railway curves
      const intermediatePoints = pointsWithKm
        .filter((item) => {
          const matchLine = !restriction.lineName || restriction.lineName === 'Tüm Hatlar' || item.point.lineName === restriction.lineName;
          return matchLine && item.kmNum >= restriction.startKmNum && item.kmNum <= restriction.endKmNum;
        })
        .map((item) => [item.point.lat, item.point.lng] as [number, number]);

      const polylineCoords: [number, number][] = [startCoord, ...intermediatePoints, endCoord];

      // Draw highlighted speed restriction track line
      const trackColor = isLifted ? '#10b981' : isPlanned ? '#f59e0b' : '#dc2626';

      // Outer glow polyline
      L.polyline(polylineCoords, {
        color: trackColor,
        weight: 8,
        opacity: isLifted ? 0.3 : 0.45,
        lineCap: 'round',
      }).addTo(takyidatGroup);

      // Inner dashed caution polyline
      const speedPolyline = L.polyline(polylineCoords, {
        color: isLifted ? '#059669' : '#b91c1c',
        weight: 4,
        dashArray: isLifted ? '8, 8' : '6, 6',
        opacity: 0.95,
      }).addTo(takyidatGroup);

      // Tooltip on the restriction line
      speedPolyline.bindTooltip(
        `
        <div class="text-xs font-sans notranslate p-1" translate="no">
          <div class="flex items-center gap-1.5 font-black ${isLifted ? 'text-emerald-700' : 'text-red-700'}">
            <span>⚠️ HIZ TAHDİDİ: ${restriction.speedLimit} KM/S</span>
          </div>
          <div class="font-bold text-slate-800 text-[11px] mt-0.5">KM ${restriction.startKm} - ${restriction.endKm}</div>
          <div class="text-slate-600 text-[10px]">${restriction.reason}</div>
          ${restriction.noticeNo ? `<div class="text-[9px] text-slate-400 font-mono mt-0.5">${restriction.noticeNo}</div>` : ''}
        </div>
      `,
        { sticky: true }
      );

      // Prominent Speed Restriction Badge at Midpoint of segment
      const midIdx = Math.floor(polylineCoords.length / 2);
      const midCoord = polylineCoords[midIdx] || startCoord;

      const badgeHtml = `
        <div class="cursor-pointer group relative flex items-center justify-center notranslate" translate="no" title="Takyidat: KM ${restriction.startKm} - ${restriction.endKm} (${restriction.speedLimit} km/s)">
          <div class="absolute -inset-1 rounded-full ${isLifted ? 'bg-emerald-400/20' : 'bg-red-500/20'}"></div>
          <div class="w-10 h-10 rounded-full border-2 ${isLifted ? 'border-emerald-600 bg-white text-emerald-800' : 'border-red-600 bg-white text-red-950'} flex flex-col items-center justify-center shadow-lg ring-2 ${isLifted ? 'ring-emerald-300' : 'ring-red-400/80'} transform transition-transform group-hover:scale-110">
            <span class="text-[7px] font-black uppercase text-red-600 leading-none">HIZ</span>
            <span class="text-xs font-black font-mono leading-none">${restriction.speedLimit}</span>
            <span class="text-[6px] font-bold text-slate-500 leading-none">KM/S</span>
          </div>
        </div>
      `;

      const badgeIcon = L.divIcon({
        html: badgeHtml,
        className: 'custom-takyidat-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const badgeMarker = L.marker(midCoord, { icon: badgeIcon }).addTo(takyidatGroup);
      badgeMarker.on('click', () => {
        if (onOpenTakyidatRef.current) onOpenTakyidatRef.current();
      });
      badgeMarker.bindTooltip(
        `
        <div class="text-xs font-sans notranslate p-1" translate="no">
          <div class="font-extrabold text-red-700">⚠️ TAKYİDAT (HIZ KISITLAMASI)</div>
          <div class="font-mono font-bold text-slate-900 mt-0.5">KM ${restriction.startKm} ➔ KM ${restriction.endKm}</div>
          <div class="text-xs font-black text-red-600">Azami Hız: ${restriction.speedLimit} km/s (Normal: ${restriction.normalSpeed || 120} km/s)</div>
          <div class="text-slate-600 text-[11px] mt-1">${restriction.reason}</div>
          <div class="text-[10px] text-sky-600 font-bold mt-1">Detayları görmek için tıklayın ➔</div>
        </div>
      `,
        { direction: 'top', offset: [0, -16] }
      );
    });
  }, [points, takyidatRestrictions, showTakyidatOverlay]);

  // Render Railway Parcels / Demiryolu Arazileri Polygons & Badges
  useEffect(() => {
    const parcelsGroup = parcelsLayerRef.current;
    if (!parcelsGroup) return;
    parcelsGroup.clearLayers();

    if (!showParcelsOverlay || !railwayParcels || railwayParcels.length === 0) return;

    railwayParcels.forEach((parcel) => {
      if (!parcel.coordinates || parcel.coordinates.length < 3) return;

      const isEncroached = parcel.encroachmentStatus === 'suspected' || parcel.encroachmentStatus === 'verified';
      const isTcdd = parcel.ownershipStatus === 'tcdd' || !parcel.ownershipStatus;
      const isTreasury = parcel.ownershipStatus === 'treasury';
      const isExpropriating = parcel.ownershipStatus === 'expropriating';

      const color = isEncroached
        ? '#ef4444'
        : isTcdd
        ? '#7c3aed'
        : isTreasury
        ? '#0284c7'
        : isExpropriating
        ? '#d97706'
        : '#8b5cf6';

      const polygon = L.polygon(parcel.coordinates, {
        color: color,
        fillColor: color,
        fillOpacity: isEncroached ? 0.32 : 0.22,
        weight: isEncroached ? 3 : 2.5,
        dashArray: isEncroached ? '6, 6' : undefined,
      }).addTo(parcelsGroup);

      // Tooltip
      polygon.bindTooltip(
        `
        <div class="text-xs font-sans notranslate p-1" translate="no">
          <div class="flex items-center gap-1.5 font-bold ${isEncroached ? 'text-red-700' : 'text-indigo-800'}">
            <span>🏛️ ADA ${parcel.adaNo} / PARSEL ${parcel.parselNo}</span>
          </div>
          <div class="font-semibold text-slate-800 text-[11px] mt-0.5">${parcel.mahalleKoy}, ${parcel.ilce}</div>
          <div class="text-slate-600 text-[10px]">${parcel.nitelik || 'Demiryolu Arazisi'} • ${parcel.alanM2?.toLocaleString('tr-TR')} m²</div>
          ${parcel.startKm ? `<div class="font-mono text-[10px] text-amber-600 font-bold mt-0.5">KM ${parcel.startKm} ${parcel.endKm ? '➔ ' + parcel.endKm : ''}</div>` : ''}
          ${isEncroached ? `<div class="text-[9px] text-red-600 font-bold mt-0.5">⚠️ İşgal / Tecavüz: ${parcel.encroachmentNote || 'Tespit Edildi'}</div>` : ''}
        </div>
      `,
        { sticky: true }
      );

      // Popup
      const tkgmLinkHtml = parcel.tkgmUrl
        ? `<a href="${parcel.tkgmUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;background-color:#0284c7;color:#ffffff;font-size:11px;font-weight:bold;padding:4px 8px;border-radius:6px;text-decoration:none;margin-top:6px;">
            <span>TKGM Parsel Sorgu'da Aç ➔</span>
          </a>`
        : '';

      polygon.bindPopup(
        `
        <div class="p-1 font-sans notranslate max-w-[260px]" translate="no">
          <div class="flex items-center justify-between gap-1 border-b border-slate-200 pb-1.5 mb-1.5">
            <span class="font-extrabold text-indigo-700 text-xs">TCDD DEMİRYOLU ARAZİSİ</span>
            <span class="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-black font-mono">Ada ${parcel.adaNo} / Parsel ${parcel.parselNo}</span>
          </div>
          <div class="text-xs font-bold text-slate-900">${parcel.mahalleKoy}, ${parcel.ilce} / ${parcel.il}</div>
          <div class="text-[11px] text-slate-600 mt-0.5"><span class="text-slate-400 font-medium">Nitelik:</span> ${parcel.nitelik || 'Demiryolu Güzergahı'}</div>
          <div class="text-[11px] text-slate-600"><span class="text-slate-400 font-medium">Malik:</span> ${parcel.malik || 'TCDD Genel Müdürlüğü'}</div>
          <div class="flex items-center justify-between text-[11px] font-mono mt-1.5 pt-1.5 border-t border-slate-100">
            <span class="text-amber-600 font-bold">${parcel.startKm ? 'KM ' + parcel.startKm : ''} ${parcel.endKm ? '➔ ' + parcel.endKm : ''}</span>
            <span class="text-emerald-700 font-bold">${parcel.alanM2?.toLocaleString('tr-TR')} m²</span>
          </div>
          ${isEncroached ? `<div class="bg-red-50 border border-red-200 text-red-800 text-[10px] p-2 rounded-lg mt-2 font-bold">⚠️ ${parcel.encroachmentNote || 'İşgal / Tecavüz Bildirimi'}</div>` : ''}
          <div class="mt-2 flex items-center justify-between gap-2">
            ${tkgmLinkHtml}
          </div>
        </div>
      `
      );

      // Midpoint badge
      const center = calculateParcelCenter(parcel.coordinates);
      const badgeHtml = `
        <div class="cursor-pointer flex items-center justify-center notranslate" translate="no" title="Ada ${parcel.adaNo} / Parsel ${parcel.parselNo}">
          <div class="px-1.5 py-0.5 rounded-md ${isEncroached ? 'bg-red-950/90 text-red-200 border-red-500' : 'bg-slate-950/90 text-indigo-200 border-indigo-400'} font-mono font-bold text-[9px] border shadow-md whitespace-nowrap">
            ${parcel.adaNo}/${parcel.parselNo}
          </div>
        </div>
      `;
      const badgeIcon = L.divIcon({
        html: badgeHtml,
        className: 'custom-parcel-badge-marker',
        iconSize: [46, 18],
        iconAnchor: [23, 9],
      });
      const badgeMarker = L.marker(center, { icon: badgeIcon }).addTo(parcelsGroup);
      badgeMarker.on('click', () => {
        polygon.openPopup();
      });
    });
  }, [railwayParcels, showParcelsOverlay, onOpenParcels]);

  // Pan to selected point
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPoint) return;

    const lat = typeof selectedPoint.lat === 'number' ? selectedPoint.lat : parseFloat(String(selectedPoint.lat));
    const lng = typeof selectedPoint.lng === 'number' ? selectedPoint.lng : parseFloat(String(selectedPoint.lng));

    if (!isNaN(lat) && !isNaN(lng)) {
      map.invalidateSize();
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.flyTo([lat, lng], Math.max(mapInstanceRef.current.getZoom(), 15), {
            duration: 0.8,
          });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [selectedPoint]);

  // Fit all points
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || points.length === 0) return;

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  };

  // Find User GPS Location
  const handleLocateMe = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!navigator.geolocation) {
      console.warn('Tarayıcınız konum servisini desteklemiyor.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
          const userIcon = L.divIcon({
            html: `
              <div class="relative flex items-center justify-center">
                <div class="absolute -inset-2 rounded-full bg-blue-500/30 animate-ping"></div>
                <div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md"></div>
              </div>
            `,
            className: 'user-location-marker',
            iconSize: [16, 16],
          });

          userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
            .bindTooltip('Mevcut Konumunuz', { permanent: false })
            .addTo(map);
        }

        map.flyTo([latitude, longitude], 14, { duration: 1 });
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error / Konum alınamadı:', err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Toggle Measurement Mode
  const handleToggleMeasurement = () => {
    setIsMeasuring((prev) => {
      const next = !prev;
      if (next) {
        setIsAddMode(false); // Mutual exclusivity
      } else {
        setMeasurePoints([]);
        setHoverPoint(null);
      }
      return next;
    });
  };

  // Invalidate map size on refresh to ensure crisp, glitch-free map re-render
  useEffect(() => {
    if (isRefreshing && mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }
  }, [isRefreshing]);

  // Open 3D Google Earth Web centered on current map viewport or selected point
  const handleOpenGoogleEarthWeb = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = selectedPoint
      ? { lat: Number(selectedPoint.lat), lng: Number(selectedPoint.lng) }
      : map.getCenter();
    // Direct 3D flight URL to exact coordinates
    const url = `https://earth.google.com/web/@${center.lat.toFixed(7)},${center.lng.toFixed(7)},350a,750d,35y,0h,45t,0r`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isGoogleEarthActive = mapType === 'google-earth' || mapType === 'google-satellite';

  // Synchronize user marker with liveGpsCoords when available
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !liveGpsCoords) return;

    const { lat, lng } = liveGpsCoords;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([lat, lng]);
    } else {
      const userIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-5 h-5 rounded-full bg-blue-500/20 ring-4 ring-blue-400/40 flex items-center justify-center">
              <div class="w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white shadow-sm"></div>
            </div>
          </div>
        `,
        className: 'user-location-marker',
        iconSize: [20, 20],
      });

      userMarkerRef.current = L.marker([lat, lng], { icon: userIcon })
        .bindTooltip('Canlı Konumunuz (GPS / Seçilen)', { permanent: false })
        .addTo(map);
    }
  }, [liveGpsCoords]);

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div
        id="railway-map-container"
        ref={mapContainerRef}
        className="w-full h-full z-0"
      />

      {/* Mode Banner when Takyidat Pick Mode is Active */}
      {isTakyidatPickMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white text-slate-800 px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-3 border border-rose-300 ring-2 ring-rose-500/10 max-w-[95vw]">
          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
            <Gauge className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {isTakyidatPickMode === 'start' && 'Takyidat Başlangıç KM için demiryoluna veya noktaya tıklayın'}
              {isTakyidatPickMode === 'end' && 'Takyidat Bitiş KM için demiryoluna veya noktaya tıklayın'}
              {isTakyidatPickMode === 'both' && '1. Aşama: Başlangıç KM için haritaya dokunun'}
              {isTakyidatPickMode === 'both-step2' && '2. Aşama: Bitiş KM için haritada ikinci noktaya dokunun'}
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              Tıkladığınız yerin demiryolu KM değeri hesaplanıp forma aktarılır
            </span>
          </div>
          {onCancelTakyidatPick && (
            <button
              id="cancel-takyidat-pick-btn"
              type="button"
              onClick={onCancelTakyidatPick}
              className="ml-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap border border-slate-200"
            >
              Vazgeç
            </button>
          )}
        </div>
      )}

      {/* Mode Banner when Live Point Pick Mode is Active */}
      {isLivePointPickMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white text-slate-800 px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-3 border border-sky-300 ring-2 ring-sky-500/10">
          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200">
            <Crosshair className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Canlı Konum İçin Haritada Bir Yere Dokunun
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              Dokunduğunuz noktanın koordinatı canlı saha konumu olarak belirlenir
            </span>
          </div>
          {onCancelLivePointPick && (
            <button
              id="cancel-live-pick-btn"
              type="button"
              onClick={onCancelLivePointPick}
              className="ml-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap border border-slate-200"
            >
              Kapat
            </button>
          )}
        </div>
      )}

      {/* Mode Banner when Add Mode is Active */}
      {isAddMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white text-slate-800 px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-3 border border-amber-300 ring-2 ring-amber-500/10">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
            <Crosshair className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Haritada İstediğiniz Noktaya Dokunun
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              Tıkladığınız koordinat otomatik olarak nokta formuna aktarılır
            </span>
          </div>
          <button
            id="cancel-add-mode-btn"
            type="button"
            onClick={() => setIsAddMode(false)}
            className="ml-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer border border-slate-200"
          >
            İptal
          </button>
        </div>
      )}

      {/* Interactive Measurement HUD Card (Single Clean Bottom Dock) */}
      {isMeasuring && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-white text-slate-800 px-4 py-3 rounded-xl shadow-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4 max-w-[95vw]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                <span>Canlı Mesafe Ölçer</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                  {measurePoints.length} Nokta {hoverPoint ? '+ Canlı' : ''}
                </span>
              </div>
              <div className="text-base sm:text-lg font-mono font-bold text-slate-900 flex items-center gap-2">
                <span>
                  {measurementResult.totalMeters > 0
                    ? measurementResult.formatted
                    : measurePoints.length === 0
                    ? 'Haritadan ilk noktayı seçin'
                    : 'Mouse ile mesafeyi ölçün'}
                </span>
                {hoverPoint && currentLiveSegment && (
                  <span className="text-xs font-mono font-normal text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 hidden sm:inline-block">
                    + {currentLiveSegment.formatted.shortText}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Undo last point */}
            <button
              id="measure-undo-btn"
              type="button"
              disabled={measurePoints.length === 0}
              onClick={() => {
                setMeasurePoints((prev) => prev.slice(0, -1));
              }}
              className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Son Noktayı Geri Al"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Geri Al</span>
            </button>

            {/* Reset */}
            <button
              id="measure-reset-btn"
              type="button"
              disabled={measurePoints.length === 0}
              onClick={() => {
                setMeasurePoints([]);
                setHoverPoint(null);
              }}
              className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Ölçümü Sıfırla"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>Sıfırla</span>
            </button>

            {/* Finish / Close */}
            <button
              id="measure-finish-btn"
              type="button"
              onClick={() => {
                setIsMeasuring(false);
                setMeasurePoints([]);
                setHoverPoint(null);
              }}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tamamla</span>
            </button>
          </div>
        </div>
      )}

      {/* Unified Map Controls (Top Right) - Single clean high-performance institutional toolbar */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-col gap-2">
        <div className="bg-white p-1 rounded-xl shadow-md border border-slate-200 flex flex-col gap-1 items-center">
          {/* Metre / Mesafe Ölçüm Butonu */}
          <button
            id="map-measure-distance-btn"
            onClick={handleToggleMeasurement}
            title={isMeasuring ? 'Ölçüm Modunu Kapat' : 'Mesafe & Metre Ölçüm Aracı'}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
              isMeasuring
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-emerald-700 hover:bg-slate-100'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>

          {/* Akıllı / Tüm KM Etiketleri Geçiş Butonu */}
          <button
            id="map-toggle-label-mode-btn"
            onClick={() => setLabelMode((prev) => (prev === 'smart' ? 'all' : 'smart'))}
            title={
              labelMode === 'smart'
                ? 'Akıllı Görünüm Aktif (Uzakta sade kalkan, yakında KM etiketleri) • Tıklayın: Tüm Etiketleri Göster'
                : 'Tüm KM Etiketleri Aktif • Tıklayın: Akıllı Görünüme Geç'
            }
            className={`p-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
              labelMode === 'smart'
                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                : 'text-slate-700 hover:text-sky-700 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Tüm Noktaları Ekrana Sığdır */}
          <button
            id="map-fit-all-btn"
            onClick={handleFitAll}
            title="Tüm Noktaları Ekrana Sığdır"
            className="p-2 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Mevcut GPS Konumuma Git */}
          <button
            id="map-locate-btn"
            onClick={handleLocateMe}
            title="Mevcut Konumuma Git"
            disabled={isLocating}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isLocating ? 'text-sky-600 animate-spin' : 'text-slate-700 hover:text-sky-600 hover:bg-slate-100'
            }`}
          >
            <Locate className="w-4 h-4" />
          </button>

          {/* Katman & Uydu Menüsü */}
          <div className="relative group">
            <button
              id="map-layers-toggle-btn"
              title="Harita Katmanları & Google Earth"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isGoogleEarthActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>

            <div className="hidden group-hover:flex flex-col gap-1.5 absolute right-0 top-0 p-3 bg-white rounded-xl shadow-xl border border-slate-200 min-w-[240px] text-xs z-40">
              <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <span>Harita &amp; Uydu Katmanı</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                  Google Earth
                </span>
              </div>

              {/* Google Earth Hybrid */}
              <button
                id="map-layer-google-earth-btn"
                onClick={() => setMapType('google-earth')}
                className={`text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                  mapType === 'google-earth'
                    ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Google Earth (Hibrit)</span>
                </div>
                {mapType === 'google-earth' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                )}
              </button>

              {/* Google Earth Pure Satellite */}
              <button
                id="map-layer-google-satellite-btn"
                onClick={() => setMapType('google-satellite')}
                className={`text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                  mapType === 'google-satellite'
                    ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-teal-600" />
                  <span>Google Earth (Saf Uydu)</span>
                </div>
                {mapType === 'google-satellite' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                )}
              </button>

              {/* Standard OSM Street */}
              <button
                id="map-layer-street-btn"
                onClick={() => setMapType('streets')}
                className={`text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                  mapType === 'streets'
                    ? 'bg-sky-50 text-sky-800 font-bold border border-sky-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Train className="w-3.5 h-3.5 text-sky-600" />
                  <span>Standart Harita (OSM)</span>
                </div>
                {mapType === 'streets' && (
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                )}
              </button>

              {/* Esri World Imagery */}
              <button
                id="map-layer-esri-satellite-btn"
                onClick={() => setMapType('esri-satellite')}
                className={`text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                  mapType === 'esri-satellite'
                    ? 'bg-slate-100 text-slate-900 font-bold border border-slate-300'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span>Esri Dünya Uydu</span>
                </div>
                {mapType === 'esri-satellite' && (
                  <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                )}
              </button>

              {/* Marker Layout & Overlays Section */}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                {/* Smart Railway Layout Toggle */}
                <label className="flex items-center justify-between cursor-pointer select-none text-sky-900 py-1 font-bold bg-sky-50/80 px-2 rounded-lg border border-sky-200/60 hover:bg-sky-50 transition-colors">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    <span>Akıllı Ray Düzeni</span>
                  </span>
                  <input
                    id="map-toggle-smart-layout"
                    type="checkbox"
                    checked={labelMode === 'smart'}
                    onChange={(e) => setLabelMode(e.target.checked ? 'smart' : 'all')}
                    className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5 cursor-pointer"
                    title="Uzaklaştığında sade kalkan rozet, yaklaştığında KM etiketleri gösterir"
                  />
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 py-1">
                  <input
                    id="map-toggle-railway-overlay"
                    type="checkbox"
                    checked={showRailwayOverlay}
                    onChange={(e) => setShowRailwayOverlay(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="font-medium">Demiryolu Hatları (OpenRailwayMap)</span>
                </label>

                {/* Takyidat Overlay Toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-red-700 py-1 font-bold">
                  <input
                    id="map-toggle-takyidat-overlay"
                    type="checkbox"
                    checked={showTakyidatOverlay}
                    onChange={(e) => setShowTakyidatOverlay(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-red-600" />
                    <span>Takyidat &amp; Hız Sınırları ({takyidatRestrictions.length})</span>
                  </span>
                </label>

                {/* Demiryolu Arazileri / Kadastro Overlay Toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-indigo-700 py-1 font-bold">
                  <input
                    id="map-toggle-parcels-overlay"
                    type="checkbox"
                    checked={showParcelsOverlay}
                    onChange={(e) => setShowParcelsOverlay(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Demiryolu Arazileri &amp; Parseller ({railwayParcels.length})</span>
                  </span>
                </label>
              </div>

              {/* Open in 3D Google Earth Web */}
              <div className="pt-1.5 border-t border-slate-100">
                <button
                  id="map-open-3d-earth-web-btn"
                  type="button"
                  onClick={handleOpenGoogleEarthWeb}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-xs transition-colors cursor-pointer"
                  title="Mevcut harita konumunu resmi 3D Google Earth Web uygulamasında açar"
                >
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>3D Google Earth Web'de Gör</span>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
