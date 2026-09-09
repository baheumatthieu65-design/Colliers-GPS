import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GPSCollar, GeofenceZone, GPSPositionLog } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Settings,
  Zap,
  MapPin,
  Battery,
  Clock,
  Navigation,
  Eye,
  EyeOff,
  Pentagon,
  Check,
  Undo,
  Trash2,
  X,
} from 'lucide-react';

interface InteractiveMapProps {
  collars: GPSCollar[];
  zones: GeofenceZone[];
  selectedCollarId: string | null;
  onSelectCollar: (id: string | null) => void;
  trackHistoryLogs: GPSPositionLog[];
  onOpenPushModalForCollar: (collarId: string) => void;
  onSaveZone?: (zone: Partial<GeofenceZone>) => void;
  startPatatoideRequest?: number;
  patatoideEditZone?: GeofenceZone | null;
  onPatatoideRequestHandled?: () => void;
}

type MapTileStyle = 'satellite' | 'topo' | 'osm';

const DEFAULT_MAP_CENTER: [number, number] = [42.9637, 0.3829];

const isValidCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const hasValidPosition = (
  collar: GPSCollar
): collar is GPSCollar & {
  currentLat: number;
  currentLng: number;
} =>
  isValidCoordinate(collar.currentLat) &&
  isValidCoordinate(collar.currentLng);

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  collars,
  zones,
  selectedCollarId,
  onSelectCollar,
  trackHistoryLogs,
  onOpenPushModalForCollar,
  onSaveZone,
  startPatatoideRequest = 0,
  patatoideEditZone = null,
  onPatatoideRequestHandled,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const markersRef = useRef<{ [collarId: string]: L.Marker }>({});
  const zonesRef = useRef<{ [zoneId: string]: L.Circle | L.Polygon }>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const userHeadingRef = useRef<number | null>(null);

  const drawingPolygonRef = useRef<L.Polygon | null>(null);
  const drawingMarkersRef = useRef<L.Marker[]>([]);

  const [tileStyle, setTileStyle] =
    useState<MapTileStyle>('satellite');

  const [isTileMenuOpen, setIsTileMenuOpen] =
    useState<boolean>(false);

  const [mapBearing, setMapBearing] =
    useState<number>(0);

  const [zoomLevel, setZoomLevel] =
    useState<number>(15);

  const [hiddenCollarIds, setHiddenCollarIds] =
    useState<string[]>([]);

  const [isDrawingPatatoide, setIsDrawingPatatoide] =
    useState<boolean>(false);

  const [drawingPoints, setDrawingPoints] =
    useState<Array<[number, number]>>([]);

  const [isSaveZoneModalOpen, setIsSaveZoneModalOpen] =
    useState<boolean>(false);

  const [patatoideName, setPatatoideName] =
    useState<string>('');

  const [patatoideColor, setPatatoideColor] =
    useState<string>('#5A6F4E');

  const [patatoideFillVisible, setPatatoideFillVisible] =
    useState<boolean>(true);

  const [patatoideEditZoneIdLocal, setPatatoideEditZoneIdLocal] =
    useState<string | null>(null);

  const initialFitDoneRef =
    useRef<boolean>(false);

  const selectedCollar =
    collars.find(c => c.id === selectedCollarId);

  /*
   * ============================================================
   * FONDS DE CARTE
   * ============================================================
   */

  const tileSources: Record<
    MapTileStyle,
    {
      url: string;
      name: string;
      attribution: string;
    }
  > = {
    satellite: {
      name: 'Vue Satellite',
      url:
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution:
        '🇫🇷',
    },

    topo: {
      name: 'Carte Topographique',
      url:
        'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution:
        '🇫🇷',
    },

    osm: {
      name: 'Plan Standard',
      url:
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '🇫🇷',
    },
  };

  /*
   * ============================================================
   * INITIALISATION DE LA CARTE
   * ============================================================
   */

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    /*
     * IMPORTANT :
     * Un nouveau collier peut ne pas encore avoir de position GPS.
     * On ne doit donc JAMAIS envoyer null à Leaflet.
     */

    const firstValidCollar = collars.find(hasValidPosition);

    const initialCenter: [number, number] =
      firstValidCollar
        ? [
            firstValidCollar.currentLat,
            firstValidCollar.currentLng,
          ]
        : DEFAULT_MAP_CENTER;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    const frenchFlagControl = L.control({ position: 'bottomleft' });
    frenchFlagControl.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-control paturgps-map-flag');
      container.textContent = '🇫🇷';
      container.title = "Pâtur'GPS";
      container.setAttribute('aria-label', "Pâtur'GPS");
      container.style.cssText = 'background:rgba(255,255,255,.9);border:1px solid rgba(0,0,0,.12);border-radius:8px;padding:3px 6px;font-size:18px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.25);';
      L.DomEvent.disableClickPropagation(container);
      return container;
    };
    frenchFlagControl.addTo(map);

    const tileLayer = L.tileLayer(
      tileSources[tileStyle].url,
      {
        maxZoom: 19,
        attribution:
          tileSources[tileStyle].attribution,
      }
    ).addTo(map);

    tileLayerRef.current = tileLayer;
    mapRef.current = map;

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    /*
     * Permet à Leaflet de recalculer correctement
     * la taille de la carte sur mobile.
     */
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      Object.values(markersRef.current).forEach(marker => {
        marker.remove();
      });

      Object.values(zonesRef.current).forEach(zone => {
        zone.remove();
      });

      drawingMarkersRef.current.forEach(marker => {
        marker.remove();
      });

      if (drawingPolygonRef.current) {
        drawingPolygonRef.current.remove();
      }

      if (polylineRef.current) {
        polylineRef.current.remove();
      }

      frenchFlagControl.remove();
      map.remove();

      mapRef.current = null;
      tileLayerRef.current = null;
      markersRef.current = {};
      zonesRef.current = {};
      drawingMarkersRef.current = [];
      drawingPolygonRef.current = null;
      polylineRef.current = null;
      if (userLocationMarkerRef.current) userLocationMarkerRef.current.remove();
      userLocationMarkerRef.current = null;
    };
  }, []);

  /*
   * ============================================================
   * POSITION UTILISATEUR + ORIENTATION
   * ============================================================
   * Point bleu façon Waze : la position est fournie par le GPS du
   * téléphone et la flèche suit le cap lorsqu'il est disponible.
   */
  useEffect(() => {
    if (!mapRef.current || !('geolocation' in navigator)) return;

    const updateUserMarker = (lat: number, lng: number, heading?: number | null) => {
      const map = mapRef.current;
      if (!map || !isValidCoordinate(lat) || !isValidCoordinate(lng)) return;
      if (typeof heading === 'number' && Number.isFinite(heading)) userHeadingRef.current = (heading + 180) % 360;
      const rotation = ((userHeadingRef.current ?? 0) + 180) % 360;
      const html = `
        <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(${rotation}deg);transform-origin:50% 100%;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:18px solid #1677ff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));"></div>
          <div style="width:16px;height:16px;border-radius:50%;background:#1683ff;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);position:relative;z-index:2;"></div>
        </div>`;
      const icon = L.divIcon({ className: 'paturgps-user-location', html, iconSize: [34,34], iconAnchor: [17,17] });
      if (!userLocationMarkerRef.current) {
        userLocationMarkerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 2000, interactive: false }).addTo(map);
      } else {
        userLocationMarkerRef.current.setLatLng([lat, lng]);
        userLocationMarkerRef.current.setIcon(icon);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      position => updateUserMarker(position.coords.latitude, position.coords.longitude, position.coords.heading),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    const onOrientation = (event: DeviceOrientationEvent) => {
      const alpha = typeof event.alpha === 'number' ? event.alpha : null;
      if (alpha === null) return;
      const heading = (540 - alpha) % 360;
      userHeadingRef.current = heading;
      const marker = userLocationMarkerRef.current;
      if (!marker) return;
      const pos = marker.getLatLng();
      updateUserMarker(pos.lat, pos.lng, heading);
    };
    window.addEventListener('deviceorientation', onOrientation, true);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('deviceorientation', onOrientation, true);
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
    };
  }, []);

  /*
   * ============================================================
   * CADRAGE AUTOMATIQUE INITIAL
   * ============================================================
   *
   * IMPORTANT :
   * Les colliers sans GPS sont ignorés.
   * On ne crée jamais de fausse position à Ilhet.
   */

  useEffect(() => {
    if (
      !mapRef.current ||
      initialFitDoneRef.current
    ) {
      return;
    }

    const validCollars = collars.filter(
      hasValidPosition
    );

    if (validCollars.length === 0) {
      return;
    }

    const visibleCollars =
      validCollars.filter(
        collar =>
          !hiddenCollarIds.includes(collar.id)
      );

    const targetList =
      visibleCollars.length > 0
        ? visibleCollars
        : validCollars;

    if (targetList.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(
      targetList.map(
        collar =>
          [
            collar.currentLat,
            collar.currentLng,
          ] as [number, number]
      )
    );

    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, {
        padding: [55, 55],
        maxZoom: 16,
        animate: false,
      });

      initialFitDoneRef.current = true;
    }
  }, [collars, hiddenCollarIds]);

  /*
   * ============================================================
   * DEMANDE DE CRÉATION DE PATATOÏDE
   * ============================================================
   */

  useEffect(() => {
    if (
      !mapRef.current ||
      startPatatoideRequest <= 0
    ) {
      return;
    }

    setIsDrawingPatatoide(true);
    setIsSaveZoneModalOpen(false);

    setPatatoideEditZoneIdLocal(patatoideEditZone?.id || null);

    if (patatoideEditZone?.polygonCoords?.length >= 3) {
      const points = patatoideEditZone.polygonCoords.map((point) => [Number(point[0]), Number(point[1])] as [number, number]);
      setDrawingPoints(points);
      setPatatoideName(patatoideEditZone.name || '');
      setPatatoideColor(patatoideEditZone.color || '#5A6F4E');
      setPatatoideFillVisible(patatoideEditZone.fillVisible !== false);

      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [70, 70], maxZoom: 17, animate: false });
      }
    } else {
      setDrawingPoints([]);
      setPatatoideName('');
      setPatatoideColor('#5A6F4E');
      setPatatoideFillVisible(true);
    }

    // Cette demande est consommée une seule fois.
    // Sans remise à zéro, revenir sur la carte remontait l'ancien
    // mode de tracé alors que l'utilisateur consultait seulement les clôtures.
    onPatatoideRequestHandled?.();
  }, [startPatatoideRequest, onPatatoideRequestHandled]);

  /*
   * ============================================================
   * CLICS SUR LA CARTE POUR DESSINER
   * ============================================================
   */

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const handleMapClick = (
      e: L.LeafletMouseEvent
    ) => {
      if (!isDrawingPatatoide) {
        return;
      }

      const newPoint: [number, number] = [
        e.latlng.lat,
        e.latlng.lng,
      ];

      setDrawingPoints(prev => [
        ...prev,
        newPoint,
      ]);
    };

    mapRef.current.on(
      'click',
      handleMapClick
    );

    return () => {
      mapRef.current?.off(
        'click',
        handleMapClick
      );
    };
  }, [isDrawingPatatoide]);

  /*
   * ============================================================
   * APERÇU PATATOÏDE
   * ============================================================
   */

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.remove();
      drawingPolygonRef.current = null;
    }

    drawingMarkersRef.current.forEach(
      marker => marker.remove()
    );

    drawingMarkersRef.current = [];

    if (drawingPoints.length === 0) {
      return;
    }

    drawingPoints.forEach((point, index) => {
      const marker = L.marker(point, {
        draggable: true,
        icon: L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${index === 0 ? '#EF4444' : '#5A6F4E'};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);cursor:grab;"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(mapRef.current!);

      marker.on('dragstart', (event) => {
        L.DomEvent.stopPropagation(event as any);
      });
      marker.on('dragend', () => {
        const latLng = marker.getLatLng();
        setDrawingPoints((prev) =>
          prev.map((p, pointIndex) =>
            pointIndex === index ? [latLng.lat, latLng.lng] : p
          )
        );
      });

      drawingMarkersRef.current.push(marker);
    });

    if (drawingPoints.length >= 2) {
      drawingPolygonRef.current =
        L.polygon(
          drawingPoints,
          {
            color: patatoideColor,
            fillColor: patatoideColor,
            fillOpacity: patatoideFillVisible ? 0.25 : 0,
            weight: 3,
            dashArray: '5, 5',
          }
        ).addTo(mapRef.current);
    }
  }, [
    drawingPoints,
    patatoideColor,
    patatoideFillVisible,
  ]);

  /*
   * ============================================================
   * CHANGEMENT DU FOND DE CARTE
   * ============================================================
   */

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(
        tileLayerRef.current
      );
    }

    const newTileLayer =
      L.tileLayer(
        tileSources[tileStyle].url,
        {
          maxZoom: 19,
          attribution:
            tileSources[tileStyle]
              .attribution,
        }
      ).addTo(mapRef.current);

    tileLayerRef.current =
      newTileLayer;
  }, [tileStyle]);

  /*
   * ============================================================
   * AFFICHAGE DES ZONES / PATATOÏDES
   * ============================================================
   */

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    Object.values(
      zonesRef.current
    ).forEach(shape =>
      shape.remove()
    );

    zonesRef.current = {};

    zones.forEach(zone => {
      if (!zone.active) {
        return;
      }

      /*
       * PATATOÏDE
       */

      if (
        zone.polygonCoords &&
        zone.polygonCoords.length >= 3
      ) {
        const validPolygon =
          zone.polygonCoords.every(
            point =>
              Array.isArray(point) &&
              point.length >= 2 &&
              isValidCoordinate(point[0]) &&
              isValidCoordinate(point[1])
          );

        if (!validPolygon) {
          return;
        }

        const shapeLayer =
          L.polygon(
            zone.polygonCoords,
            {
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: zone.fillVisible === false ? 0 : 0.2,
              weight: 2.5,
              dashArray: '6, 6',
            }
          ).addTo(
            mapRef.current!
          );

        shapeLayer.bindTooltip(
          `<b>${zone.name} (Patatoïde)</b><br/>Clôture virtuelle tracée`,
          {
            permanent: false,
            direction: 'top',
            className:
              'bg-slate-900 text-white border-0 text-xs rounded-lg px-2 py-1 shadow-md',
          }
        );

        zonesRef.current[zone.id] =
          shapeLayer;

        return;
      }

      /*
       * ZONE CIRCULAIRE
       */

      if (
        !isValidCoordinate(
          zone.centerLat
        ) ||
        !isValidCoordinate(
          zone.centerLng
        ) ||
        !isValidCoordinate(
          zone.radiusMeters
        ) ||
        zone.radiusMeters <= 0
      ) {
        /*
         * Zone incomplète :
         * on l'ignore plutôt que de faire planter Leaflet.
         */
        return;
      }

      const shapeLayer =
        L.circle(
          [
            zone.centerLat,
            zone.centerLng,
          ],
          {
            radius:
              zone.radiusMeters,
            color: zone.color,
            fillColor: zone.color,
            fillOpacity: zone.fillVisible === false ? 0 : 0.15,
            weight: 2,
            dashArray: '6, 6',
          }
        ).addTo(
          mapRef.current!
        );

      shapeLayer.bindTooltip(
        `<b>${zone.name}</b><br/>Rayon: ${zone.radiusMeters}m`,
        {
          permanent: false,
          direction: 'top',
          className:
            'bg-slate-900 text-white border-0 text-xs rounded-lg px-2 py-1 shadow-md',
        }
      );

      zonesRef.current[zone.id] =
        shapeLayer;
    });
  }, [zones]);

  /*
   * ============================================================
   * AFFICHAGE DES COLLIERS
   * ============================================================
   *
   * CORRECTION PRINCIPALE :
   * Si currentLat/currentLng sont null,
   * aucun marker Leaflet n'est créé.
   *
   * Le collier reste parfaitement enregistré
   * dans l'application et apparaîtra sur la carte
   * dès qu'une vraie position GPS sera reçue.
   */

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    collars.forEach(collar => {
      const isHidden =
        hiddenCollarIds.includes(
          collar.id
        );

      /*
       * Collier masqué
       */

      if (isHidden) {
        if (
          markersRef.current[
            collar.id
          ]
        ) {
          markersRef.current[
            collar.id
          ].remove();

          delete markersRef.current[
            collar.id
          ];
        }

        return;
      }

      /*
       * NOUVEAU COLLIER SANS POSITION GPS
       *
       * C'est ici que l'ancien code provoquait :
       * "can't access property lat, n is null"
       */

      if (!hasValidPosition(collar)) {
        if (
          markersRef.current[
            collar.id
          ]
        ) {
          markersRef.current[
            collar.id
          ].remove();

          delete markersRef.current[
            collar.id
          ];
        }

        return;
      }

      const isSelected =
        collar.id ===
        selectedCollarId;

      const isOutOfZone =
        collar.status ===
        'out_of_zone';

      /*
       * Icône personnalisée
       */

      const markerHtml = `
        <div
          style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
          "
        >

          ${
            isOutOfZone
              ? `
                <div
                  style="
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 14px;
                    height: 14px;
                    background: #F43F5E;
                    border-radius: 50%;
                    animation: pulse 1.5s infinite;
                  "
                ></div>
              `
              : ''
          }

          <div
            style="
              background-color: ${collar.color};
              color: #ffffff;
              font-weight: 700;
              font-size: 11px;
              padding: 3px 8px;
              border-radius: 12px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              border: ${
                isSelected
                  ? '3px solid #ffffff'
                  : '2px solid rgba(255,255,255,0.8)'
              };
              white-space: nowrap;
              display: flex;
              align-items: center;
              gap: 4px;
              transform: ${
                isSelected
                  ? 'scale(1.15)'
                  : 'scale(1)'
              };
              transition: all 0.2s ease;
            "
          >
            <span>
              🐑 ${collar.sheepName}
            </span>

            ${
              collar.pushMode?.active
                ? '⚡'
                : ''
            }
          </div>

          <div
            style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid ${collar.color};
              margin-top: -1px;
            "
          ></div>

        </div>
      `;

      const customIcon =
        L.divIcon({
          html: markerHtml,
          className:
            'custom-sheep-marker',
          iconSize: [120, 42],
          iconAnchor: [60, 42],
        });

      /*
       * Mise à jour du marker existant
       */

      if (
        markersRef.current[
          collar.id
        ]
      ) {
        markersRef.current[
          collar.id
        ].setLatLng([
          collar.currentLat,
          collar.currentLng,
        ]);

        markersRef.current[
          collar.id
        ].setIcon(customIcon);

        return;
      }

      /*
       * Création du marker
       */

      const marker =
        L.marker(
          [
            collar.currentLat,
            collar.currentLng,
          ],
          {
            icon: customIcon,
          }
        )
          .addTo(
            mapRef.current!
          )
          .on(
            'click',
            () => {
              onSelectCollar(
                collar.id
              );
            }
          );

      markersRef.current[
        collar.id
      ] = marker;
    });

    /*
     * Nettoyage des anciens colliers
     */

    Object.keys(
      markersRef.current
    ).forEach(id => {
      const collarStillExists =
        collars.some(
          collar =>
            collar.id === id
        );

      const collarIsHidden =
        hiddenCollarIds.includes(id);

      const collar =
        collars.find(
          c => c.id === id
        );

      const collarHasNoPosition =
        collar &&
        !hasValidPosition(
          collar
        );

      if (
        !collarStillExists ||
        collarIsHidden ||
        collarHasNoPosition
      ) {
        markersRef.current[
          id
        ].remove();

        delete markersRef.current[
          id
        ];
      }
    });
  }, [
    collars,
    selectedCollarId,
    hiddenCollarIds,
    onSelectCollar,
  ]);

  /*
   * ============================================================
   * HISTORIQUE DU PARCOURS
   * ============================================================
   */

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    /*
     * On ne conserve que les points GPS valides.
     */

    const validLogs =
      trackHistoryLogs.filter(
        log =>
          isValidCoordinate(
            log.lat
          ) &&
          isValidCoordinate(
            log.lng
          )
      );

    if (validLogs.length === 0) {
      return;
    }

    const latLngs: [
      number,
      number
    ][] =
      validLogs.map(log => [
        log.lat,
        log.lng,
      ]);

    const activeCollar =
      collars.find(
        collar =>
          collar.id ===
          validLogs[0]?.collarId
      );

    const lineColor =
      activeCollar?.color ||
      '#3B82F6';

    polylineRef.current =
      L.polyline(
        latLngs,
        {
          color: lineColor,
          weight: 4,
          opacity: 0.85,
          dashArray: '4, 8',
        }
      ).addTo(
        mapRef.current
      );

    const bounds =
      polylineRef.current.getBounds();

    if (bounds.isValid()) {
      mapRef.current.fitBounds(
        bounds,
        {
          padding: [50, 50],
        }
      );
    }
  }, [
    trackHistoryLogs,
    collars,
  ]);

  /*
   * ============================================================
   * ROTATION
   * ============================================================
   */

  const handleRotate = (
    angleChange: number
  ) => {
    const newBearing =
      (mapBearing +
        angleChange +
        360) %
      360;

    setMapBearing(
      newBearing
    );
  };

  const handleResetNorth = () => {
    setMapBearing(0);
  };

  /*
   * ============================================================
   * ZOOM
   * ============================================================
   */

  const handleZoom = (
    delta: number
  ) => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.setZoom(
      mapRef.current.getZoom() +
        delta
    );
  };

  /*
   * ============================================================
   * RECENTRAGE
   * ============================================================
   */

  const fitValidCollars = () => {
    if (!mapRef.current) {
      return;
    }

    const validCollars =
      collars.filter(
        hasValidPosition
      );

    if (
      validCollars.length === 0
    ) {
      /*
       * Aucun collier GPS :
       * on ne bouge pas la carte.
       */
      return;
    }

    const visibleCollars =
      validCollars.filter(
        collar =>
          !hiddenCollarIds.includes(
            collar.id
          )
      );

    const targetList =
      visibleCollars.length > 0
        ? visibleCollars
        : validCollars;

    if (
      targetList.length === 0
    ) {
      return;
    }

    const bounds =
      L.latLngBounds(
        targetList.map(
          collar =>
            [
              collar.currentLat,
              collar.currentLng,
            ] as [
              number,
              number
            ]
        )
      );

    if (bounds.isValid()) {
      mapRef.current.fitBounds(
        bounds,
        {
          padding: [60, 60],
          maxZoom: 16,
        }
      );
    }
  };

  const handleRecenter = () => {
    if (!mapRef.current) {
      return;
    }

    /*
     * Sur téléphone :
     * essayer d'abord la position réelle
     * de l'utilisateur.
     */

    if (
      'geolocation' in
      navigator
    ) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const {
            latitude,
            longitude,
          } = position.coords;

          if (
            isValidCoordinate(
              latitude
            ) &&
            isValidCoordinate(
              longitude
            )
          ) {
            mapRef.current?.panTo(
              [
                latitude,
                longitude,
              ],
              {
                animate: true,
              }
            );
          }
        },
        () => {
          /*
           * GPS utilisateur refusé :
           * retour sur les colliers.
           */

          fitValidCollars();
        },
        {
          enableHighAccuracy:
            true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );

      return;
    }

    fitValidCollars();
  };

  const handleCenterOnCollar = (collar: GPSCollar) => {
    if (!mapRef.current || !hasValidPosition(collar)) return;
    mapRef.current.flyTo([collar.currentLat, collar.currentLng], Math.max(mapRef.current.getZoom(), 16), { duration: 0.8 });
    onSelectCollar(collar.id);
  };

  /*
   * ============================================================
   * VISIBILITÉ DES COLLIERS
   * ============================================================
   */

  const toggleCollarVisibility = (
    id: string
  ) => {
    setHiddenCollarIds(prev =>
      prev.includes(id)
        ? prev.filter(
            collarId =>
              collarId !== id
          )
        : [
            ...prev,
            id,
          ]
    );
  };

  const toggleAllCollars = () => {
    if (
      collars.length === 0
    ) {
      return;
    }

    if (
      hiddenCollarIds.length === 0
    ) {
      setHiddenCollarIds(
        collars.map(
          collar => collar.id
        )
      );
    } else {
      setHiddenCollarIds([]);
    }
  };

  /*
   * ============================================================
   * DESSIN PATATOÏDE
   * ============================================================
   */

  const handleUndoPoint = () => {
    setDrawingPoints(
      prev => prev.slice(0, -1)
    );
  };

  const handleClearDrawing = () => {
    setDrawingPoints([]);
  };

  /*
   * ============================================================
   * ENREGISTREMENT PATATOÏDE
   * ============================================================
   */

  const handleSavePatatoideSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      drawingPoints.length < 3
    ) {
      return;
    }

    if (onSaveZone) {
      onSaveZone({
        name:
          patatoideName ||
          `Patatoïde Estive (${zones.length + 1})`,

        description:
          patatoideEditZoneIdLocal && patatoideEditZone
            ? patatoideEditZone.description || `Zone patatoïde retracée avec ${drawingPoints.length} sommets`
            : `Zone patatoïde tracée manuellement avec ${drawingPoints.length} sommets`,

        id: patatoideEditZoneIdLocal || undefined,

        polygonCoords:
          drawingPoints,

        color:
          patatoideColor,

        assignedCollarIds:
          patatoideEditZoneIdLocal && patatoideEditZone
            ? patatoideEditZone.assignedCollarIds
            : ['all'],

        active: true,

        alertOnExit: true,

        fillVisible: patatoideFillVisible,
      });
    }

    setIsSaveZoneModalOpen(
      false
    );

    setIsDrawingPatatoide(
      false
    );

    setDrawingPoints([]);

    setPatatoideName('');
    setPatatoideEditZoneIdLocal(null);
  };

  /*
   * ============================================================
   * AFFICHAGE
   * ============================================================
   */

  return (
    <div className="flex flex-col space-y-2">

      {/* ======================================================
          BARRE SUPÉRIEURE
          ====================================================== */}

      <div className="bg-white/95 backdrop-blur-md p-1.5 sm:p-2 rounded-xl border border-[#E2E6DF] shadow-xs flex flex-wrap items-center justify-between gap-2">

        {/* VISIBILITÉ COLLIERS */}

        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">

          <span className="text-[9px] sm:text-[11px] font-bold text-[#7D8A74] uppercase tracking-wider whitespace-nowrap mr-1">
            Affichage colliers:
          </span>

          <button
            onClick={
              toggleAllCollars
            }
            className="px-2 py-1 rounded-lg bg-[#F2F4F1] hover:bg-[#E2E6DF] text-[#3E4A35] font-semibold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1"
            title="Tout afficher / Tout masquer"
          >
            {hiddenCollarIds.length ===
            0 ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-red-500" />
            )}

            <span>
              {hiddenCollarIds.length ===
              0
                ? 'Masquer Tous'
                : 'Afficher Tous'}
            </span>
          </button>

          {collars.map(collar => {
            const isHidden =
              hiddenCollarIds.includes(
                collar.id
              );

            const hasGPS =
              hasValidPosition(
                collar
              );

            return (
              <button
                key={collar.id}
                onClick={() =>
                  toggleCollarVisibility(
                    collar.id
                  )
                }
                className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center space-x-1.5 border whitespace-nowrap ${
                  isHidden
                    ? 'bg-stone-100 text-stone-400 border-stone-200 line-through'
                    : 'text-white shadow-2xs'
                }`}
                style={{
                  backgroundColor:
                    isHidden
                      ? '#F3F4F6'
                      : collar.color,

                  borderColor:
                    isHidden
                      ? '#E5E7EB'
                      : 'rgba(0,0,0,0.1)',

                  color:
                    isHidden
                      ? '#9CA3AF'
                      : '#FFFFFF',
                }}
                title={
                  hasGPS
                    ? `${collar.sheepName} - GPS actif`
                    : `${collar.sheepName} - En attente de position GPS`
                }
              >
                <span className="text-[10px]">
                  {isHidden
                    ? '◌'
                    : hasGPS
                    ? '◉'
                    : '○'}
                </span>

                <span>
                  {collar.sheepName}
                </span>
              </button>
            );
          })}
        </div>

        {/* BOUTON PATATOÏDE */}

        <div className="flex items-center space-x-2">

          {!isDrawingPatatoide ? (
            <button
              onClick={() => {
                setIsDrawingPatatoide(
                  true
                );
                setDrawingPoints([]);
              }}
              className="bg-[#5A6F4E] hover:bg-[#4A5D3E] text-white font-bold text-xs px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <Pentagon className="w-3.5 h-3.5" />

              <span>
                Patatoïde
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                setIsDrawingPatatoide(
                  false
                );
                setDrawingPoints([]);
              }}
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />

              <span>
                Quitter Tracé
              </span>
            </button>
          )}

        </div>
      </div>

      {/* ======================================================
          BANDEAU MODE PATATOÏDE
          ====================================================== */}

      {isDrawingPatatoide && (
        <div className="bg-[#5A6F4E] text-white p-2.5 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-2 text-xs">

          <div className="flex items-center space-x-2">

            <Pentagon className="w-4 h-4 text-emerald-300" />

            <span className="font-bold">
              Mode Tracé Patatoïde :
              Cliquez sur la carte
              pour définir les sommets
              de la zone.
            </span>

            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
              {drawingPoints.length} point(s) placés
            </span>

          </div>

          <div className="flex items-center space-x-1.5">

            <button
              onClick={
                handleUndoPoint
              }
              disabled={
                drawingPoints.length ===
                0
              }
              className="bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white font-semibold px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer"
            >
              <Undo className="w-3.5 h-3.5" />

              <span>
                Annuler Dernier
              </span>
            </button>

            <button
              onClick={
                handleClearDrawing
              }
              disabled={
                drawingPoints.length ===
                0
              }
              className="bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white font-semibold px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />

              <span>
                Effacer Tout
              </span>
            </button>

            <button
              onClick={() =>
                setIsSaveZoneModalOpen(
                  true
                )
              }
              disabled={
                drawingPoints.length <
                3
              }
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold px-3 py-1 rounded-lg flex items-center space-x-1 cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4" />

              <span>
                Valider la Patatoïde (
                {drawingPoints.length}{' '}
                pts)
              </span>
            </button>

          </div>
        </div>
      )}

      {/* ======================================================
          CARTE
          ====================================================== */}

      <div className="relative w-full h-[calc(100dvh-205px)] min-h-[360px] max-h-none sm:h-[calc(100vh-135px)] sm:min-h-[440px] sm:max-h-[820px] bg-slate-950 overflow-hidden rounded-2xl border border-slate-800 shadow-xl flex flex-col">

        {/* CONTENEUR LEAFLET */}

        <div
          ref={mapContainerRef}
          className="w-full h-full transition-transform duration-300 ease-out z-0 cursor-crosshair"
          style={{
            transform:
              `rotate(${mapBearing}deg)`,
            transformOrigin:
              'center center',
          }}
        />

        {/* ==================================================
            NORD
            ================================================== */}

        <div className="absolute top-3 right-3 z-20 flex flex-col items-center pointer-events-auto">

          <button
            onClick={
              handleResetNorth
            }
            title="Réinitialiser la carte au Nord (0°)"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#2C3327]/60 hover:bg-[#2C3327]/85 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer group active:scale-95"
          >

            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-300"
              style={{
                transform:
                  `rotate(${-mapBearing}deg)`,
              }}
            >

              <div className="relative flex flex-col items-center">

                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[15px] border-b-red-500 drop-shadow-sm" />

                <span className="text-[9px] font-black text-white leading-none mt-0.5 tracking-tighter">
                  N
                </span>

              </div>
            </div>
          </button>

          {mapBearing !== 0 && (
            <span className="text-[10px] font-mono font-bold text-white/90 bg-[#2C3327]/60 backdrop-blur-xs px-1.5 py-0.5 rounded-md mt-1 shadow-xs">
              {mapBearing}°
            </span>
          )}

        </div>

        {/* ==================================================
            ZOOM / RECENTRAGE
            ================================================== */}

        <div className="absolute top-16 right-3 z-20 bg-[#2C3327]/60 backdrop-blur-md p-1 rounded-xl border border-white/20 shadow-md flex flex-col space-y-1">

          <button
            onClick={() =>
              handleZoom(1)
            }
            className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
            title="Zoom Avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={() =>
              handleZoom(-1)
            }
            className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
            title="Zoom Arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <div className="w-full h-[1px] bg-white/20" />

          <button
            onClick={
              handleRecenter
            }
            className="p-1.5 hover:bg-white/20 text-emerald-400 rounded-lg transition-all cursor-pointer"
            title="Recentrer le Troupeau"
          >
            <Navigation className="w-4 h-4" />
          </button>

          <div className="w-full h-[1px] bg-white/20" />

          <div className="flex flex-col items-center gap-1 py-0.5" title="Centrer une brebis">
            {collars.filter(hasValidPosition).map((collar) => (
              <button
                key={`center-${collar.id}`}
                type="button"
                onClick={() => handleCenterOnCollar(collar)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-all cursor-pointer"
                title={`Centrer ${collar.sheepName}`}
                aria-label={`Centrer ${collar.sheepName}`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: collar.color }}
                />
              </button>
            ))}
          </div>

        </div>

        {/* ==================================================
            SÉLECTEUR FOND DE CARTE
            ================================================== */}

        <div className="absolute bottom-3 right-3 z-30 flex flex-col items-end">

          {isTileMenuOpen && (
            <div className="mb-2 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-[#E2E6DF] shadow-xl flex flex-col space-y-1.5 text-xs text-[#2C3327] min-w-[170px] animate-fade-in">

              <span className="text-[10px] font-bold text-[#7D8A74] uppercase tracking-wider px-2 pt-1">
                Fond de Plan Map:
              </span>

              {(
                [
                  'satellite',
                  'topo',
                  'osm',
                ] as MapTileStyle[]
              ).map(style => (

                <button
                  key={style}
                  onClick={() => {
                    setTileStyle(
                      style
                    );
                    setIsTileMenuOpen(
                      false
                    );
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer flex items-center justify-between ${
                    tileStyle ===
                    style
                      ? 'bg-[#5A6F4E] text-white font-bold shadow-xs'
                      : 'hover:bg-[#F2F4F1] text-[#2C3327]'
                  }`}
                >

                  <span>
                    {
                      tileSources[
                        style
                      ].name
                    }
                  </span>

                  {tileStyle ===
                    style && (
                    <Check className="w-3.5 h-3.5" />
                  )}

                </button>
              ))}
            </div>
          )}

          <button
            onClick={() =>
              setIsTileMenuOpen(
                prev => !prev
              )
            }
            title="Changer le Fond de Plan"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#2C3327]/70 hover:bg-[#2C3327]/90 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer active:scale-95"
          >
            <Settings
              className={`w-5 h-5 ${
                isTileMenuOpen
                  ? 'rotate-90 text-emerald-400'
                  : ''
              } transition-transform duration-300`}
            />
          </button>

        </div>

        {/* ==================================================
            CARTE DU COLLIER SÉLECTIONNÉ
            ================================================== */}

        {selectedCollar && (
          <div className="absolute bottom-3 left-3 right-16 md:right-auto md:w-96 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#E2E6DF] shadow-xl text-[#2C3327]">

            <div className="flex items-start justify-between">

              <div className="flex items-center space-x-2.5">

                <div
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-base text-white shadow-xs border border-white/40"
                  style={{
                    backgroundColor:
                      selectedCollar.color,
                  }}
                >
                  🐑
                </div>

                <div>

                  <h3 className="font-bold text-[#2C3327] text-sm">
                    {
                      selectedCollar.sheepName
                    }
                  </h3>

                  <span className="text-[11px] text-[#7D8A74] font-mono">
                    {
                      selectedCollar.collarNumber
                    }
                  </span>

                </div>
              </div>

              <button
                onClick={() =>
                  onSelectCollar(
                    null
                  )
                }
                className="text-[#7D8A74] hover:text-[#2C3327] text-[11px] px-2 py-0.5 rounded bg-[#F2F4F1] border border-[#E2E6DF] cursor-pointer"
              >
                ✕
              </button>

            </div>

            <div className="grid grid-cols-2 gap-2 my-2 text-xs">

              <div className="bg-[#F2F4F1] p-1.5 rounded-xl border border-[#E2E6DF] flex items-center space-x-1.5">

                <Battery
                  className={`w-3.5 h-3.5 ${
                    selectedCollar.batteryLevel <
                    30
                      ? 'text-red-500'
                      : 'text-[#5A6F4E]'
                  }`}
                />

                <div>

                  <span className="text-[#7D8A74] block text-[9px]">
                    Batterie
                  </span>

                  <span className="font-semibold text-[#2C3327] text-xs">
                    {
                      selectedCollar.batteryLevel
                    }
                    %
                  </span>

                </div>
              </div>

              <div className="bg-[#F2F4F1] p-1.5 rounded-xl border border-[#E2E6DF] flex items-center space-x-1.5">

                <Clock className="w-3.5 h-3.5 text-[#5A6F4E]" />

                <div>

                  <span className="text-[#7D8A74] block text-[9px]">
                    Dernier GPS
                  </span>

                  <span className="font-semibold text-[#2C3327] text-xs">
                    {
                      selectedCollar.lastUpdate
                        ? (() => {
                            const date = new Date(selectedCollar.lastUpdate);
                            const now = new Date();
                            const yesterday = new Date(now);
                            yesterday.setDate(now.getDate() - 1);
                            const sameDay = (a: Date, b: Date) =>
                              a.getFullYear() === b.getFullYear() &&
                              a.getMonth() === b.getMonth() &&
                              a.getDate() === b.getDate();
                            const label = sameDay(date, now)
                              ? 'Auj.'
                              : sameDay(date, yesterday)
                              ? 'Hier'
                              : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return `${label} ${time}`;
                          })()
                        : '--:--'
                    }
                  </span>

                </div>
              </div>

            </div>

            {/* PUSH RAPIDE */}

            <button
              onClick={() =>
                onOpenPushModalForCollar(
                  selectedCollar.id
                )
              }
              className="w-full py-1.5 bg-[#E67E22] hover:bg-[#D35400] text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer transition-all active:scale-95"
            >

              <Zap className="w-3.5 h-3.5 fill-current" />

              <span>
                {selectedCollar.pushMode?.active
                  ? `PUSH Actif (${selectedCollar.pushMode.intervalSeconds}s)`
                  : 'Forcer Envoi PUSH (10-30 min)'}
              </span>

            </button>

          </div>
        )}

        {/* ==================================================
            INFOS HISTORIQUE
            ================================================== */}

        {trackHistoryLogs.length >
          0 && (
          <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#5A6F4E] text-[#3E4A35] text-xs flex items-center space-x-2 shadow-md">

            <MapPin className="w-3.5 h-3.5 text-[#5A6F4E]" />

            <span>
              Parcours:{' '}
              <strong>
                {
                  trackHistoryLogs.length
                }{' '}
                points GPS
              </strong>
            </span>

          </div>
        )}

      </div>

      {/* ======================================================
          MODALE PATATOÏDE
          ====================================================== */}

      {isSaveZoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">

          <div className="bg-white rounded-2xl border border-[#E2E6DF] max-w-md w-full p-6 shadow-2xl space-y-4">

            <div className="flex items-center justify-between border-b border-[#E2E6DF] pb-3">

              <div className="flex items-center space-x-2 text-[#3E4A35]">

                <Pentagon className="w-5 h-5 text-[#5A6F4E]" />

                <h3 className="font-bold text-base">
                  {patatoideEditZoneIdLocal ? 'Modifier la Zone Patatoïde' : 'Enregistrer la Zone Patatoïde'}
                </h3>

              </div>

              <button
                onClick={() =>
                  setIsSaveZoneModalOpen(
                    false
                  )
                }
                className="text-[#7D8A74] hover:text-[#2C3327]"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                handleSavePatatoideSubmit
              }
              className="space-y-4 text-xs"
            >

              {/* NOM */}

              <div>

                <label className="block text-[#3E4A35] font-bold mb-1">
                  Nom de la Zone Patatoïde *
                </label>

                <input
                  type="text"
                  required
                  placeholder="ex: Estive Saugué Haute, Enclos Pâturage N°3..."
                  value={
                    patatoideName
                  }
                  onChange={e =>
                    setPatatoideName(
                      e.target.value
                    )
                  }
                  className="w-full p-2.5 bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A6F4E]"
                />

              </div>

              {/* COULEUR */}

              <div>

                <label className="block text-[#3E4A35] font-bold mb-1">
                  Couleur de la Limite sur la Carte
                </label>

                <div className="flex items-center space-x-2">

                  {[
                    '#5A6F4E',
                    '#10B981',
                    '#3B82F6',
                    '#EF4444',
                    '#8B5CF6',
                    '#F59E0B',
                  ].map(color => (

                    <button
                      type="button"
                      key={color}
                      onClick={() =>
                        setPatatoideColor(
                          color
                        )
                      }
                      className={`w-7 h-7 rounded-full transition-transform border-2 ${
                        patatoideColor ===
                        color
                          ? 'scale-110 border-black'
                          : 'border-transparent'
                      }`}
                      style={{
                        backgroundColor:
                          color,
                      }}
                    />

                  ))}

                </div>
              </div>

              {/* REMPLISSAGE */}
              <div className="flex items-center justify-between bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3 py-2.5">
                <div>
                  <div className="text-xs font-bold text-[#3E4A35]">Afficher le cœur de la zone</div>
                  <div className="text-[10px] text-[#7D8A74]">Désactivé = uniquement le contour</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPatatoideFillVisible(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${patatoideFillVisible ? 'bg-[#5A6F4E]' : 'bg-stone-300'}`}
                  aria-pressed={patatoideFillVisible}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${patatoideFillVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* INFORMATIONS */}

              <div className="bg-[#F2F4F1] p-3 rounded-xl text-[11px] text-[#7D8A74] space-y-1">

                <p>
                  •{' '}
                  <strong>
                    {
                      drawingPoints.length
                    }{' '}
                    sommets
                  </strong>{' '}
                  enregistrés sur la
                  carte.
                </p>

                <p>
                  • Les brebis recevront
                  une alerte dès qu'elles
                  franchiront cette
                  frontière patatoïde.
                </p>

                <p>
                  • Un nom déjà utilisé
                  est autorisé : une
                  nouvelle zone sera créée
                  sans remplacer
                  l’ancienne.
                </p>

              </div>

              {/* BOUTONS */}

              <div className="flex justify-end space-x-2 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setIsSaveZoneModalOpen(
                      false
                    )
                  }
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-[#5A6F4E] hover:bg-[#4A5D3E] text-white rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  {patatoideEditZoneIdLocal ? 'Enregistrer les modifications' : 'Créer la Zone Patatoïde'}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
