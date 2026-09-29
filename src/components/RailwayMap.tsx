import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { RailwayPoint, RailwayPointCategory } from '../types.ts';
import { CategoryColorConfig, DEFAULT_CATEGORY_COLORS, formatKmDisplay } from '../utils/categoryColors.ts';
import { getDistanceMeters, formatMeterDistance, calculatePolylineMeasurements, LatLngPoint } from '../utils/measurement.ts';
import { Layers, Locate, Maximize2, Plus, Train, Ruler, RotateCcw, Undo2, Check, RotateCw, Globe, ExternalLink, MapPin, Crosshair } from 'lucide-react';

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
}

function createMarkerIcon(
  point: RailwayPoint,
  isSelected: boolean,
  categoryColors: Record<RailwayPointCategory, CategoryColorConfig> = DEFAULT_CATEGORY_COLORS
) {
  const cat = categoryColors[point.category] || categoryColors.km_marker || DEFAULT_CATEGORY_COLORS.km_marker;
  const cleanKm = formatKmDisplay(point.kmValue, point.title);
  // Prominently display KM value (e.g. "KM 142+250") or fallback to category label
  const displayBadge = cleanKm
    ? (cleanKm.toLowerCase().startsWith('km') ? cleanKm : `KM ${cleanKm}`)
    : (cat.shortLabel || cat.label);

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer transition-transform duration-200 notranslate ${
      isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-10'
    }" translate="no">
      ${
        isSelected
          ? `<div class="absolute -inset-2.5 rounded-full bg-amber-400/40 animate-ping"></div>`
          : ''
      }
      <div style="background-color: ${cat.bg}; border-color: ${
    isSelected ? '#fbbf24' : cat.border
  }; color: ${cat.text || '#ffffff'};"
           class="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono font-bold text-xs shadow-lg border-2 whitespace-nowrap min-w-max">
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
    iconSize: [100, 32],
    iconAnchor: [50, 32],
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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const railwayLayerRef = useRef<L.TileLayer | null>(null);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);

  const [mapType, setMapType] = useState<'streets' | 'google-earth' | 'google-satellite' | 'esri-satellite'>('google-earth');
  const [showRailwayOverlay, setShowRailwayOverlay] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Meter & Distance Measurement State
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [measurePoints, setMeasurePoints] = useState<LatLngPoint[]>([]);
  const [hoverPoint, setHoverPoint] = useState<LatLngPoint | null>(null);

  // Refs to eliminate stale closure bugs in map click handlers
  const isAddModeRef = useRef(isAddMode);
  isAddModeRef.current = isAddMode;

  const onMapClickAddRef = useRef(onMapClickAdd);
  onMapClickAddRef.current = onMapClickAdd;

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

    const markersGroup = L.layerGroup().addTo(map);
    const measureGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = markersGroup;
    railwayLayerRef.current = railwayOverlay;
    measureLayerRef.current = measureGroup;

    // Map click handler - strictly accesses current values via refs to avoid stale closure
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isMeasuringRef.current) {
        setMeasurePoints((prev) => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
        return;
      }

      if (isAddModeRef.current && onMapClickAddRef.current) {
        onMapClickAddRef.current(e.latlng.lat, e.latlng.lng);
        setIsAddMode(false);
      }
    });

    // Real-time mouse movement listener like Google Earth / Maps ruler:
    // As the mouse moves, dynamic distance updates in real time
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (isMeasuringRef.current && measurePointsRef.current.length > 0) {
        setHoverPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    map.on('mouseout', () => {
      setHoverPoint(null);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
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
      if (isAddMode || isMeasuring) {
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
  }, [isAddMode, isMeasuring]);

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

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    points.forEach((point) => {
      const isSelected = selectedPoint?.id === point.id;
      const icon = createMarkerIcon(point, isSelected, categoryColors);

      const marker = L.marker([point.lat, point.lng], { icon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        // If measuring, allow snapping this point into measurement
        if (isMeasuringRef.current) {
          setMeasurePoints((prev) => [...prev, { lat: point.lat, lng: point.lng }]);
          return;
        }
        onSelectPoint(point);
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
        { direction: 'top', offset: [0, -32] }
      );

      marker.addTo(markersGroup);
    });
  }, [points, selectedPoint, onSelectPoint, categoryColors]);

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

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div
        id="railway-map-container"
        ref={mapContainerRef}
        className="w-full h-full z-0"
      />

      {/* Mode Banner when Add Mode is Active */}
      {isAddMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-3 border-2 border-amber-300 ring-4 ring-amber-500/20 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="w-8 h-8 rounded-xl bg-slate-950/10 flex items-center justify-center shrink-0">
            <Crosshair className="w-5 h-5 text-slate-950 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[13px] sm:text-sm font-extrabold text-slate-950 leading-tight">
              Haritada Bir Yere Tıklayın
            </span>
            <span className="text-[11px] font-medium text-amber-950 opacity-90">
              Tıkladığınız yerin konumu ve koordinatları otomatik alınacaktır
            </span>
          </div>
          <button
            id="cancel-add-mode-btn"
            type="button"
            onClick={() => setIsAddMode(false)}
            className="ml-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            İptal
          </button>
        </div>
      )}

      {/* Mode Banner when Measurement Mode is Active */}
      {isMeasuring && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-950/90 text-white px-4 py-2 rounded-2xl font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-2.5 border-2 border-emerald-500/80 backdrop-blur-md">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
          <Ruler className="w-4 h-4 text-emerald-400" />
          <span>
            {measurePoints.length === 0
              ? 'Başlangıç için haritada bir noktaya tıklayın'
              : 'Mouse\'u hareket ettirin, sabitlemek için tıklayın'}
          </span>
          <button
            id="close-measure-banner-btn"
            onClick={() => {
              setIsMeasuring(false);
              setMeasurePoints([]);
              setHoverPoint(null);
            }}
            className="ml-2 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 text-xs px-2.5 py-1 rounded-xl transition-colors cursor-pointer border border-slate-700"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Interactive Measurement HUD Card (Bottom of Map) */}
      {isMeasuring && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex flex-col sm:flex-row items-center gap-4 max-w-[95vw]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span>Canlı Mesafe Ölçer</span>
                <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.2 rounded font-mono">
                  {measurePoints.length} Sabit Nokta {hoverPoint ? '+ Canlı Konum' : ''}
                </span>
              </div>
              <div className="text-lg sm:text-xl font-mono font-bold text-white flex items-center gap-2">
                <span>
                  {measurementResult.totalMeters > 0
                    ? measurementResult.formatted
                    : measurePoints.length === 0
                    ? 'Başlangıç noktasını seçin...'
                    : 'Mouse\'u gezdirin...'}
                </span>
                {hoverPoint && currentLiveSegment && (
                  <span className="text-xs font-mono font-normal text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-700/60 hidden sm:inline-block">
                    + {currentLiveSegment.formatted.shortText}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo last point */}
            <button
              id="measure-undo-btn"
              type="button"
              disabled={measurePoints.length === 0}
              onClick={() => {
                setMeasurePoints((prev) => prev.slice(0, -1));
              }}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Son Noktayı Geri Al"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-400" />
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
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Ölçümü Sıfırla"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
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
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-md transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tamamla</span>
            </button>
          </div>
        </div>
      )}

      {/* Map Controls Floating Bar (Top Right) - Organized into nested cards (kutucuk içinde kutucuk) */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-col gap-2">
        {/* Kutu 1: Harita Ölçüm & İşlem Araçları Kutusu */}
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-slate-200/90 flex flex-col gap-1 items-center">
          {/* Metre / Mesafe Ölçüm Butonu */}
          <button
            id="map-measure-distance-btn"
            onClick={handleToggleMeasurement}
            title={isMeasuring ? 'Ölçüm Modunu Kapat' : 'Mesafe & Metre Ölçüm Aracı'}
            className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
              isMeasuring
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-100'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>

          {/* Haritadan Tıkla & Ekle Hızlı Butonu */}
          <button
            id="map-click-add-quick-btn"
            onClick={() => {
              setIsAddMode(!isAddMode);
              if (!isAddMode) setIsMeasuring(false);
            }}
            title={isAddMode ? 'Tıkla Ekle İptal' : 'Haritadan Tıkla & Ekle'}
            className={`hidden sm:flex p-2 sm:p-2.5 rounded-xl transition-all items-center justify-center cursor-pointer ${
              isAddMode
                ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400/50'
                : 'text-slate-700 hover:text-amber-600 hover:bg-slate-100'
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Harita ve Noktaları Yenile Butonu */}
          {onRefresh && (
            <button
              id="map-refresh-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Haritayı ve Noktaları Yenile"
              className={`hidden sm:flex p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
                isRefreshing ? 'text-sky-600 animate-spin' : 'text-slate-700 hover:text-sky-600 hover:bg-slate-100'
              }`}
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          {/* Fit all points */}
          <button
            id="map-fit-all-btn"
            onClick={handleFitAll}
            title="Tüm Noktaları Ekrana Sığdır"
            className="p-2 sm:p-2.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Locate user */}
          <button
            id="map-locate-btn"
            onClick={handleLocateMe}
            title="Mevcut Konumuma Git"
            disabled={isLocating}
            className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer ${
              isLocating ? 'text-blue-500 animate-pulse' : 'text-slate-700 hover:text-blue-600 hover:bg-slate-100'
            }`}
          >
            <Locate className="w-4 h-4" />
          </button>
        </div>

        {/* Kutu 2: Görünüm & Katmanlar Kutusu */}
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-slate-200/90 flex flex-col gap-1 items-center">
          {/* Google Earth Hızlı Aç / Kapat Butonu */}
          <button
            id="map-google-earth-quick-btn"
            onClick={() => {
              setMapType(isGoogleEarthActive ? 'streets' : 'google-earth');
            }}
            title={
              isGoogleEarthActive
                ? 'Google Earth Uydu Modu Aktif (Standart Haritaya Geç)'
                : 'Google Earth Uydu Haritasına Geç'
            }
            className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
              isGoogleEarthActive
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                : 'text-slate-700 hover:text-emerald-600 hover:bg-slate-100'
            }`}
          >
            <Globe className="w-4 h-4" />
          </button>

          {/* Layer Selector */}
          <div className="relative group">
            <button
              id="map-layers-toggle-btn"
              title="Harita Katmanları & Google Earth"
              className="p-2 sm:p-2.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4" />
            </button>

          <div className="hidden group-hover:flex flex-col gap-1.5 absolute right-0 top-0 p-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 min-w-[240px] text-xs z-40 animate-in fade-in zoom-in-95 duration-150">
            <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-200/80 flex items-center justify-between">
              <span>Harita &amp; Uydu Katmanı</span>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                Google Earth
              </span>
            </div>

            {/* Google Earth Hybrid */}
            <button
              id="map-layer-google-earth-btn"
              onClick={() => setMapType('google-earth')}
              className={`text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between cursor-pointer ${
                mapType === 'google-earth'
                  ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                  : 'text-slate-700 hover:bg-slate-100'
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
              className={`text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between cursor-pointer ${
                mapType === 'google-satellite'
                  ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                  : 'text-slate-700 hover:bg-slate-100'
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
              className={`text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between cursor-pointer ${
                mapType === 'streets'
                  ? 'bg-sky-50 text-sky-800 font-bold border border-sky-200'
                  : 'text-slate-700 hover:bg-slate-100'
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
              className={`text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between cursor-pointer ${
                mapType === 'esri-satellite'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-300'
                  : 'text-slate-700 hover:bg-slate-100'
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

            {/* OpenRailwayMap Overlay Checkbox */}
            <div className="pt-2 border-t border-slate-100">
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
            </div>

            {/* Open in 3D Google Earth Web */}
            <div className="pt-1.5 border-t border-slate-100">
              <button
                id="map-open-3d-earth-web-btn"
                type="button"
                onClick={handleOpenGoogleEarthWeb}
                className="w-full flex items-center justify-between px-2.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-[11px] shadow-sm transition-all active:scale-[0.98] cursor-pointer"
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

      {/* Total Points Badge */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl shadow-lg border border-slate-700/50 flex items-center gap-2 text-xs font-medium">
        <Train className="w-3.5 h-3.5 text-sky-400" />
        <span>
          {points.length} demiryolu noktası kayıtlı
        </span>
      </div>
    </div>
  );
};
