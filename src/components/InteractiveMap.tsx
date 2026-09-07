import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GPSCollar, GeofenceZone, GPSPositionLog } from '../types';
import { 
  RotateCw, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Settings, 
  Zap, 
  MapPin, 
  Battery, 
  Clock, 
  ShieldAlert,
  Navigation,
  Eye,
  EyeOff,
  Pentagon,
  Check,
  Undo,
  Trash2,
  X,
  Plus
} from 'lucide-react';

interface InteractiveMapProps {
  collars: GPSCollar[];
  zones: GeofenceZone[];
  selectedCollarId: string | null;
  onSelectCollar: (id: string | null) => void;
  trackHistoryLogs: GPSPositionLog[];
  onOpenPushModalForCollar: (collarId: string) => void;
  onSaveZone?: (zone: Partial<GeofenceZone>) => void;
}

type MapTileStyle = 'satellite' | 'topo' | 'osm';

const OFFLINE_ORTHO_MAX_ZOOM = 13;
const OFFLINE_ORTHO_CENTER = { lat: 42.9200, lng: 0.3900 };
const OFFLINE_ORTHO_RADIUS_KM = 30;

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  collars,
  zones,
  selectedCollarId,
  onSelectCollar,
  trackHistoryLogs,
  onOpenPushModalForCollar,
  onSaveZone,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  const markersRef = useRef<{ [collarId: string]: L.Marker }>({});
  const zonesRef = useRef<{ [zoneId: string]: L.Circle | L.Polygon }>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  
  // Drawing Layer Refs
  const drawingPolygonRef = useRef<L.Polygon | null>(null);
  const drawingMarkersRef = useRef<L.CircleMarker[]>([]);

  // States
  const [tileStyle, setTileStyle] = useState<MapTileStyle>('satellite');
  const [isTileMenuOpen, setIsTileMenuOpen] = useState<boolean>(false);
  const [mapBearing, setMapBearing] = useState<number>(0); // North direction rotation angle
  const [zoomLevel, setZoomLevel] = useState<number>(13);
  const [offlineOrthoAvailable, setOfflineOrthoAvailable] = useState<boolean>(true);

  // Collar visibility toggle states (petits boutons pour afficher ou pas chaque collier)
  const [hiddenCollarIds, setHiddenCollarIds] = useState<string[]>([]);

  // Patatoïde drawing states
  const [isDrawingPatatoide, setIsDrawingPatatoide] = useState<boolean>(false);
  const [drawingPoints, setDrawingPoints] = useState<Array<[number, number]>>([]);
  const [isSaveZoneModalOpen, setIsSaveZoneModalOpen] = useState<boolean>(false);
  const [patatoideName, setPatatoideName] = useState<string>('');
  const [patatoideColor, setPatatoideColor] = useState<string>('#5A6F4E');

  const selectedCollar = collars.find(c => c.id === selectedCollarId);

  // Fond de carte : l'orthophoto IGN est prioritairement locale.
  // Les tuiles sont fournies dans public/offline-maps/ign-ortho/{z}/{x}/{y}.jpg
  // et restent donc disponibles même sans réseau une fois la PWA installée et
  // le paquet de carte intégré au déploiement. Le script scripts/download-offline-ortho.mjs
  // permet de constituer ce paquet autour d'Ilhet.
  const tileSources: Record<MapTileStyle, { url: string; name: string; attribution: string; maxNativeZoom: number }> = {
    satellite: {
      name: 'Orthophoto IGN · hors-ligne',
      url: '/offline-maps/ign-ortho/{z}/{x}/{y}.jpg',
      attribution: 'IGN · BD ORTHO® · Licence Ouverte Etalab',
      maxNativeZoom: OFFLINE_ORTHO_MAX_ZOOM,
    },
    topo: {
      name: 'Carte Topographique',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: 'OpenTopoMap & SRTM Contour',
      maxNativeZoom: 17,
    },
    osm: {
      name: 'Plan Standard',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: 'OpenStreetMap Contributors',
      maxNativeZoom: 19,
    },
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLat = collars[0]?.currentLat || OFFLINE_ORTHO_CENTER.lat;
    const initialLng = collars[0]?.currentLng || OFFLINE_ORTHO_CENTER.lng;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
    });

    const source = tileSources[tileStyle];
    const tileLayer = L.tileLayer(source.url, {
      maxZoom: 19,
      maxNativeZoom: source.maxNativeZoom,
      attribution: source.attribution,
    }).addTo(map);

    tileLayer.on('tileerror', (event: any) => {
      if (tileStyle === 'satellite') {
        setOfflineOrthoAvailable(false);
        // En ligne, on bascule sur l'orthophoto IGN distante si une tuile
        // locale n'est pas présente. Hors-ligne, Leaflet conserve la tuile
        // locale disponible et aucun appel réseau n'est requis.
        if (navigator.onLine) {
          const tile = event.tile as HTMLImageElement;
          const z = Math.min(map.getZoom(), OFFLINE_ORTHO_MAX_ZOOM);
          const x = (event.coords as any).x;
          const y = (event.coords as any).y;
          tile.src = `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;
        }
      }
    });

    tileLayerRef.current = tileLayer;
    mapRef.current = map;

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle Map Clicks for Patatoïde Boundary Drawing
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isDrawingPatatoide) return;
      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
      setDrawingPoints(prev => [...prev, newPoint]);
    };

    mapRef.current.on('click', handleMapClick);

    return () => {
      mapRef.current?.off('click', handleMapClick);
    };
  }, [isDrawingPatatoide]);

  // Update Patatoïde Preview Polygon & Vertex Markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old drawing shapes
    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.remove();
      drawingPolygonRef.current = null;
    }
    drawingMarkersRef.current.forEach(m => m.remove());
    drawingMarkersRef.current = [];

    if (drawingPoints.length > 0) {
      // Draw vertex markers
      drawingPoints.forEach((pt, index) => {
        const marker = L.circleMarker(pt, {
          radius: 6,
          color: '#ffffff',
          fillColor: index === 0 ? '#EF4444' : '#5A6F4E',
          fillOpacity: 1,
          weight: 2,
        }).addTo(mapRef.current!);
        drawingMarkersRef.current.push(marker);
      });

      // Draw polygon preview if >= 2 points
      if (drawingPoints.length >= 2) {
        drawingPolygonRef.current = L.polygon(drawingPoints, {
          color: patatoideColor,
          fillColor: patatoideColor,
          fillOpacity: 0.25,
          weight: 3,
          dashArray: '5, 5',
        }).addTo(mapRef.current);
      }
    }
  }, [drawingPoints, patatoideColor]);

  // Update Tile Layer when style changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const source = tileSources[tileStyle];
    const newTileLayer = L.tileLayer(source.url, {
      maxZoom: 19,
      maxNativeZoom: source.maxNativeZoom,
      attribution: source.attribution,
    }).addTo(mapRef.current);

    newTileLayer.on('tileerror', (event: any) => {
      if (tileStyle === 'satellite') {
        setOfflineOrthoAvailable(false);
        if (navigator.onLine) {
          const tile = event.tile as HTMLImageElement;
          const z = Math.min(mapRef.current!.getZoom(), OFFLINE_ORTHO_MAX_ZOOM);
          const x = (event.coords as any).x;
          const y = (event.coords as any).y;
          tile.src = `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;
        }
      }
    });
    tileLayerRef.current = newTileLayer;
    setOfflineOrthoAvailable(true);
  }, [tileStyle]);

  // Render Geofence Zones (Circle or Patatoïde Polygon)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old zones
    Object.values(zonesRef.current).forEach((shape) => shape.remove());
    zonesRef.current = {};

    zones.forEach(zone => {
      if (!zone.active) return;

      let shapeLayer: L.Circle | L.Polygon;

      if (zone.polygonCoords && zone.polygonCoords.length >= 3) {
        // Patatoïde Polygon Zone
        shapeLayer = L.polygon(zone.polygonCoords, {
          color: zone.color,
          fillColor: zone.color,
          fillOpacity: 0.2,
          weight: 2.5,
          dashArray: '6, 6',
        }).addTo(mapRef.current!);

        shapeLayer.bindTooltip(`<b>${zone.name} (Patatoïde)</b><br/>Clôture virtuelle tracée`, {
          permanent: false,
          direction: 'top',
          className: 'bg-slate-900 text-white border-0 text-xs rounded-lg px-2 py-1 shadow-md',
        });
      } else {
        // Circle Zone
        shapeLayer = L.circle([zone.centerLat, zone.centerLng], {
          radius: zone.radiusMeters,
          color: zone.color,
          fillColor: zone.color,
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '6, 6',
        }).addTo(mapRef.current!);

        shapeLayer.bindTooltip(`<b>${zone.name}</b><br/>Rayon: ${zone.radiusMeters}m`, {
          permanent: false,
          direction: 'top',
          className: 'bg-slate-900 text-white border-0 text-xs rounded-lg px-2 py-1 shadow-md',
        });
      }

      zonesRef.current[zone.id] = shapeLayer;
    });
  }, [zones]);

  // Render / Update Collar Markers with assigned custom colors & respect hiddenCollarIds
  useEffect(() => {
    if (!mapRef.current) return;

    collars.forEach(collar => {
      const isHidden = hiddenCollarIds.includes(collar.id);

      if (isHidden) {
        // If hidden, remove marker if present
        if (markersRef.current[collar.id]) {
          markersRef.current[collar.id].remove();
          delete markersRef.current[collar.id];
        }
        return;
      }

      const isSelected = collar.id === selectedCollarId;
      const isOutOfZone = collar.status === 'out_of_zone';

      // Custom HTML Marker Icon
      const markerHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          ${isOutOfZone ? '<div class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full animate-ping"></div>' : ''}
          <div style="
            background-color: ${collar.color};
            color: #ffffff;
            font-weight: 700;
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 12px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            border: ${isSelected ? '3px solid #ffffff' : '2px solid rgba(255,255,255,0.8)'};
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
            transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
            transition: all 0.2s ease;
          ">
            <span>🐑 ${collar.sheepName}</span>
            ${collar.pushMode.active ? '⚡' : ''}
          </div>
          <div style="
            width: 0; 
            height: 0; 
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid ${collar.color};
            margin-top: -1px;
          "></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-sheep-marker',
        iconSize: [120, 42],
        iconAnchor: [60, 42],
      });

      if (markersRef.current[collar.id]) {
        markersRef.current[collar.id].setLatLng([collar.currentLat, collar.currentLng]);
        markersRef.current[collar.id].setIcon(customIcon);
      } else {
        const marker = L.marker([collar.currentLat, collar.currentLng], { icon: customIcon })
          .addTo(mapRef.current!)
          .on('click', () => {
            onSelectCollar(collar.id);
          });

        markersRef.current[collar.id] = marker;
      }
    });

    // Remove deleted collars or newly hidden collars
    Object.keys(markersRef.current).forEach(id => {
      if (!collars.some(c => c.id === id) || hiddenCollarIds.includes(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [collars, selectedCollarId, hiddenCollarIds]);

  // Render Track History Polyline
  useEffect(() => {
    if (!mapRef.current) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (trackHistoryLogs.length > 0) {
      const latLngs: [number, number][] = trackHistoryLogs.map(log => [log.lat, log.lng]);
      const activeCollar = collars.find(c => c.id === trackHistoryLogs[0]?.collarId);
      const lineColor = activeCollar?.color || '#3B82F6';

      polylineRef.current = L.polyline(latLngs, {
        color: lineColor,
        weight: 4,
        opacity: 0.85,
        dashArray: '4, 8',
      }).addTo(mapRef.current);

      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    }
  }, [trackHistoryLogs]);

  // Rotate map container (Nord / Bearing manipulation)
  const handleRotate = (angleChange: number) => {
    const newBearing = (mapBearing + angleChange + 360) % 360;
    setMapBearing(newBearing);
  };

  const handleResetNorth = () => {
    setMapBearing(0);
  };

  const handleZoom = (delta: number) => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(mapRef.current.getZoom() + delta);
  };

  const handleRecenter = () => {
    if (!mapRef.current || collars.length === 0) return;
    if (selectedCollar) {
      mapRef.current.panTo([selectedCollar.currentLat, selectedCollar.currentLng]);
    } else {
      const visibleCollars = collars.filter(c => !hiddenCollarIds.includes(c.id));
      const targetList = visibleCollars.length > 0 ? visibleCollars : collars;
      const bounds = L.latLngBounds(targetList.map(c => [c.currentLat, c.currentLng]));
      mapRef.current.fitBounds(bounds, { padding: [60, 60] });
    }
  };

  // Toggle single collar visibility
  const toggleCollarVisibility = (id: string) => {
    setHiddenCollarIds(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  // Toggle all collars visibility
  const toggleAllCollars = () => {
    if (hiddenCollarIds.length === 0) {
      setHiddenCollarIds(collars.map(c => c.id));
    } else {
      setHiddenCollarIds([]);
    }
  };

  // Undo last point in Patatoïde drawing
  const handleUndoPoint = () => {
    setDrawingPoints(prev => prev.slice(0, -1));
  };

  // Clear Patatoïde drawing
  const handleClearDrawing = () => {
    setDrawingPoints([]);
  };

  // Finalize Patatoïde and save
  const handleSavePatatoideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (drawingPoints.length < 3) return;

    if (onSaveZone) {
      onSaveZone({
        name: patatoideName || `Patatoïde Estive (${zones.length + 1})`,
        description: `Zone patatoïde tracée manuellement avec ${drawingPoints.length} sommets`,
        polygonCoords: drawingPoints,
        color: patatoideColor,
        assignedCollarIds: ['all'],
        active: true,
        alertOnExit: true,
      });
    }

    // Reset drawing state
    setIsSaveZoneModalOpen(false);
    setIsDrawingPatatoide(false);
    setDrawingPoints([]);
    setPatatoideName('');
  };

  return (
    <div className="flex flex-col space-y-2">
      
      {/* TOP STRIP: Collar Display Toggles & Patatoïde Creator Mode Button */}
      <div className="bg-white/95 backdrop-blur-md p-2 rounded-xl border border-[#E2E6DF] shadow-xs flex flex-wrap items-center justify-between gap-2">
        
        {/* Collar Visibility Toggle Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          <span className="text-[11px] font-bold text-[#7D8A74] uppercase tracking-wider whitespace-nowrap mr-1">
            Affichage colliers:
          </span>

          <button
            onClick={toggleAllCollars}
            className="px-2 py-1 rounded-lg bg-[#F2F4F1] hover:bg-[#E2E6DF] text-[#3E4A35] font-semibold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1"
            title="Tout afficher / Tout masquer"
          >
            {hiddenCollarIds.length === 0 ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-red-500" />}
            <span>{hiddenCollarIds.length === 0 ? 'Masquer Tous' : 'Afficher Tous'}</span>
          </button>

          {collars.map(c => {
            const isHidden = hiddenCollarIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCollarVisibility(c.id)}
                className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center space-x-1.5 border whitespace-nowrap ${
                  isHidden 
                    ? 'bg-stone-100 text-stone-400 border-stone-200 line-through' 
                    : 'text-white shadow-2xs'
                }`}
                style={{
                  backgroundColor: isHidden ? '#F3F4F6' : c.color,
                  borderColor: isHidden ? '#E5E7EB' : 'rgba(0,0,0,0.1)',
                  color: isHidden ? '#9CA3AF' : '#FFFFFF'
                }}
              >
                <span>{isHidden ? '🙈' : '👁️'}</span>
                <span>{c.sheepName}</span>
              </button>
            );
          })}
        </div>

        {/* Patatoïde Freeform Drawing Trigger */}
        <div className="flex items-center space-x-2">
          {!isDrawingPatatoide ? (
            <button
              onClick={() => {
                setIsDrawingPatatoide(true);
                setDrawingPoints([]);
              }}
              className="bg-[#5A6F4E] hover:bg-[#4A5D3E] text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <Pentagon className="w-3.5 h-3.5" />
              <span>✍️ Tracé Patatoïde (Limite Zone)</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setIsDrawingPatatoide(false);
                setDrawingPoints([]);
              }}
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Quitter Tracé</span>
            </button>
          )}
        </div>
      </div>

      {/* Drawing Mode Active Banner Controls */}
      {isDrawingPatatoide && (
        <div className="bg-[#5A6F4E] text-white p-2.5 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-2 text-xs animate-pulse">
          <div className="flex items-center space-x-2">
            <Pentagon className="w-4 h-4 text-emerald-300" />
            <span className="font-bold">
              Mode Tracé Patatoïde : Cliquez sur la carte pour définir les sommets de la zone.
            </span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
              {drawingPoints.length} point(s) placés
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleUndoPoint}
              disabled={drawingPoints.length === 0}
              className="bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white font-semibold px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer"
            >
              <Undo className="w-3.5 h-3.5" />
              <span>Annuler Dernier</span>
            </button>

            <button
              onClick={handleClearDrawing}
              disabled={drawingPoints.length === 0}
              className="bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white font-semibold px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Effacer Tout</span>
            </button>

            <button
              onClick={() => setIsSaveZoneModalOpen(true)}
              disabled={drawingPoints.length < 3}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold px-3 py-1 rounded-lg flex items-center space-x-1 cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Valider la Patatoïde ({drawingPoints.length} pts)</span>
            </button>
          </div>
        </div>
      )}

      {/* Offline map status */}
      {tileStyle === 'satellite' && (
        <div className="absolute top-3 left-3 z-30 pointer-events-none">
          <div className="bg-[#2C3327]/80 backdrop-blur-md text-white rounded-xl px-3 py-2 shadow-lg border border-white/20 text-[11px]">
            <div className="font-bold flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${offlineOrthoAvailable ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              Orthophoto IGN hors-ligne
            </div>
            <div className="text-white/75 mt-0.5">Ilhet · rayon 30 km · détail limité au zoom 13</div>
          </div>
        </div>
      )}

      {/* MAP CANVAS CONTAINER - Sized to fit screen without scrolling */}
      <div className="relative w-full h-[calc(100vh-135px)] min-h-[440px] max-h-[820px] bg-slate-950 overflow-hidden rounded-2xl border border-slate-800 shadow-xl flex flex-col">
        
        {/* Map Container with CSS Transform for Bearing Rotation */}
        <div 
          ref={mapContainerRef} 
          className="w-full h-full transition-transform duration-300 ease-out z-0 cursor-crosshair"
          style={{
            transform: `rotate(${mapBearing}deg)`,
            transformOrigin: 'center center',
          }}
        />

        {/* TOP RIGHT: TRANSPARENT NORTH INDICATOR ARROW (Flèche du Nord en transparence) */}
        <div className="absolute top-3 right-3 z-20 flex flex-col items-center pointer-events-auto">
          <button
            onClick={handleResetNorth}
            title="Réinitialiser la carte au Nord (0°)"
            className="w-10 h-10 rounded-full bg-[#2C3327]/60 hover:bg-[#2C3327]/85 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer group active:scale-95"
          >
            <div 
              className="w-full h-full flex items-center justify-center transition-transform duration-300"
              style={{ transform: `rotate(${-mapBearing}deg)` }}
            >
              {/* North Arrow Red Spearhead */}
              <div className="relative flex flex-col items-center">
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[15px] border-b-red-500 drop-shadow-sm"></div>
                <span className="text-[9px] font-black text-white leading-none mt-0.5 tracking-tighter">N</span>
              </div>
            </div>
          </button>
          {mapBearing !== 0 && (
            <span className="text-[10px] font-mono font-bold text-white/90 bg-[#2C3327]/60 backdrop-blur-xs px-1.5 py-0.5 rounded-md mt-1 shadow-xs">
              {mapBearing}°
            </span>
          )}
        </div>

        {/* MID RIGHT: ZOOM & RECENTER CONTROLS */}
        <div className="absolute top-16 right-3 z-20 bg-[#2C3327]/60 backdrop-blur-md p-1 rounded-xl border border-white/20 shadow-md flex flex-col space-y-1">
          <button
            onClick={() => handleZoom(1)}
            className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
            title="Zoom Avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(-1)}
            className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
            title="Zoom Arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-full h-[1px] bg-white/20" />
          <button
            onClick={handleRecenter}
            className="p-1.5 hover:bg-white/20 text-emerald-400 rounded-lg transition-all cursor-pointer"
            title="Recentrer le Troupeau"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>

        {/* BOTTOM RIGHT: GEAR ICON BUTTON FOR BASEMAP SELECTOR (Engrenage fond de plan en pied de page) */}
        <div className="absolute bottom-3 right-3 z-30 flex flex-col items-end">
          
          {/* Basemap Selection Menu Popover */}
          {isTileMenuOpen && (
            <div className="mb-2 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-[#E2E6DF] shadow-xl flex flex-col space-y-1.5 text-xs text-[#2C3327] min-w-[170px] animate-fade-in">
              <span className="text-[10px] font-bold text-[#7D8A74] uppercase tracking-wider px-2 pt-1">
                Fond de Plan Map:
              </span>

              {(['satellite', 'topo', 'osm'] as MapTileStyle[]).map((style) => (
                <button
                  key={style}
                  onClick={() => {
                    setTileStyle(style);
                    setIsTileMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer flex items-center justify-between ${
                    tileStyle === style 
                      ? 'bg-[#5A6F4E] text-white font-bold shadow-xs' 
                      : 'hover:bg-[#F2F4F1] text-[#2C3327]'
                  }`}
                >
                  <span>{tileSources[style].name}</span>
                  {tileStyle === style && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}

          {/* Gear Button */}
          <button
            onClick={() => setIsTileMenuOpen(prev => !prev)}
            title="Changer le Fond de Plan (Satellite / Topo / Plan)"
            className="w-10 h-10 rounded-full bg-[#2C3327]/70 hover:bg-[#2C3327]/90 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer active:scale-95"
          >
            <Settings className={`w-5 h-5 ${isTileMenuOpen ? 'rotate-90 text-emerald-400' : ''} transition-transform duration-300`} />
          </button>
        </div>

        {/* BOTTOM FLOATING CARD: Selected Sheep Details & Quick Push Button */}
        {selectedCollar && (
          <div className="absolute bottom-3 left-3 right-16 md:right-auto md:w-96 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#E2E6DF] shadow-xl text-[#2C3327]">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base text-white shadow-xs border border-white/40"
                  style={{ backgroundColor: selectedCollar.color }}
                >
                  🐑
                </div>
                <div>
                  <h3 className="font-bold text-[#2C3327] text-sm">{selectedCollar.sheepName}</h3>
                  <span className="text-[11px] text-[#7D8A74] font-mono">{selectedCollar.collarNumber}</span>
                </div>
              </div>
              
              <button
                onClick={() => onSelectCollar(null)}
                className="text-[#7D8A74] hover:text-[#2C3327] text-[11px] px-2 py-0.5 rounded bg-[#F2F4F1] border border-[#E2E6DF] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs">
              <div className="bg-[#F2F4F1] p-1.5 rounded-xl border border-[#E2E6DF] flex items-center space-x-1.5">
                <Battery className={`w-3.5 h-3.5 ${selectedCollar.batteryLevel < 30 ? 'text-red-500' : 'text-[#5A6F4E]'}`} />
                <div>
                  <span className="text-[#7D8A74] block text-[9px]">Batterie</span>
                  <span className="font-semibold text-[#2C3327] text-xs">{selectedCollar.batteryLevel}%</span>
                </div>
              </div>

              <div className="bg-[#F2F4F1] p-1.5 rounded-xl border border-[#E2E6DF] flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-[#5A6F4E]" />
                <div>
                  <span className="text-[#7D8A74] block text-[9px]">Dernier GPS</span>
                  <span className="font-semibold text-[#2C3327] text-xs">
                    {new Date(selectedCollar.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Push Mode Trigger */}
            <button
              onClick={() => onOpenPushModalForCollar(selectedCollar.id)}
              className="w-full py-1.5 bg-[#E67E22] hover:bg-[#D35400] text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>
                {selectedCollar.pushMode.active 
                  ? `PUSH Actif (${selectedCollar.pushMode.intervalSeconds}s)` 
                  : 'Forcer Envoi PUSH (10-30 min)'}
              </span>
            </button>
          </div>
        )}

        {/* Track History Active Polyline Info Bar */}
        {trackHistoryLogs.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#5A6F4E] text-[#3E4A35] text-xs flex items-center space-x-2 shadow-md">
            <MapPin className="w-3.5 h-3.5 text-[#5A6F4E]" />
            <span>Parcours: <strong>{trackHistoryLogs.length} points GPS</strong></span>
          </div>
        )}
      </div>

      {/* Modal: Naming and Saving Patatoïde Zone */}
      {isSaveZoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E2E6DF] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E6DF] pb-3">
              <div className="flex items-center space-x-2 text-[#3E4A35]">
                <Pentagon className="w-5 h-5 text-[#5A6F4E]" />
                <h3 className="font-bold text-base">Enregistrer la Zone Patatoïde</h3>
              </div>
              <button 
                onClick={() => setIsSaveZoneModalOpen(false)}
                className="text-[#7D8A74] hover:text-[#2C3327]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePatatoideSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#3E4A35] font-bold mb-1">
                  Nom de la Zone Patatoïde *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Estive Saugué Haute, Enclos Pâturage N°3..."
                  value={patatoideName}
                  onChange={(e) => setPatatoideName(e.target.value)}
                  className="w-full p-2.5 bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A6F4E]"
                />
              </div>

              <div>
                <label className="block text-[#3E4A35] font-bold mb-1">
                  Couleur de la Limite sur la Carte
                </label>
                <div className="flex items-center space-x-2">
                  {['#5A6F4E', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#F59E0B'].map(color => (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setPatatoideColor(color)}
                      className={`w-7 h-7 rounded-full transition-transform border-2 ${
                        patatoideColor === color ? 'scale-110 border-black' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-[#F2F4F1] p-3 rounded-xl text-[11px] text-[#7D8A74] space-y-1">
                <p>• <strong>{drawingPoints.length} sommets</strong> enregistrés sur la carte.</p>
                <p>• Les brebis recevront une alerte dès qu'elles franchiront cette frontière patatoïde.</p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveZoneModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#5A6F4E] hover:bg-[#4A5D3E] text-white rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  Créer la Zone Patatoïde
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
