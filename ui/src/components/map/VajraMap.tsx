"use client";

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  BENGALURU_RADAR_BOUNDS,
  DEFAULT_BASEMAP_STYLE,
  DEFAULT_VIEWPORT,
  MAPBOX_STYLES,
  RADAR_LAYER_ID,
  RADAR_SOURCE_ID,
  STORM_CELLS_SOURCE_ID,
  STORM_CELLS_HULL_LAYER_ID,
  STORM_CELLS_CONTOUR_LAYER_ID,
  STORM_CELLS_VECTOR_LAYER_ID,
  STORM_CELLS_CENTROID_LAYER_ID,
  STORM_CELLS_LABELS_LAYER_ID,
  STORM_CELLS_UNCERTAINTY_30MIN_FILL_ID,
  STORM_CELLS_UNCERTAINTY_30MIN_LINE_ID,
  STORM_CELLS_UNCERTAINTY_15MIN_FILL_ID,
  STORM_CELLS_UNCERTAINTY_15MIN_LINE_ID,
  VIEWPORT_3D,
  getMapboxToken,
  getRadarFrameUrl,
  getRadarCellsManifestUrl,
  getRadarCellsUrl,
} from '@/lib/mapbox';
import { KeyRound, ExternalLink } from 'lucide-react';

interface VajraMapProps {
  onMapReady?: (map: mapboxgl.Map) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  timeIdx?: number;
  stormCellsVisible?: boolean;
}

export default function VajraMap({
  onMapReady,
  className = '',
  style,
  children,
  timeIdx = 0,
  stormCellsVisible = true,
}: VajraMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const [tokenMissing, setTokenMissing] = useState<boolean>(false);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  // Keep a ref to onMapReady so that parent re-renders never trigger effect re-runs
  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  });

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    const token = getMapboxToken();
    if (!token) {
      setTokenMissing(true);
      return;
    }

    setTokenMissing(false);
    mapboxgl.accessToken = token;

    if (!mapContainerRef.current) return;
    // Prevent duplicate instantiation if already active
    if (mapInstanceRef.current) return;

    try {
      // 1. Create Mapbox GL instance with 3D oblique perspective
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: DEFAULT_BASEMAP_STYLE,
        center: DEFAULT_VIEWPORT.center,
        zoom: DEFAULT_VIEWPORT.zoom,
        pitch: DEFAULT_VIEWPORT.pitch,
        bearing: DEFAULT_VIEWPORT.bearing,
        minZoom: DEFAULT_VIEWPORT.minZoom,
        maxZoom: DEFAULT_VIEWPORT.maxZoom,
        attributionControl: true,
        logoPosition: 'bottom-left',
        trackResize: true,
      });

      mapInstanceRef.current = map;

      // 2. Setup 3D Environment (Terrain DEM, Standard Night Theme, 3D Buildings)
      const configure3DEnvironment = () => {
        try {
          const isStandardStyle = typeof (map as any).setConfigProperty === 'function';

          // A. Mapbox Standard Style: Configure nocturnal operational atmosphere
          if (isStandardStyle) {
            try {
              (map as any).setConfigProperty('basemap', 'lightPreset', 'night');
              (map as any).setConfigProperty('basemap', 'show3dObjects', true);
            } catch (cfgErr) {
              console.warn('[VajraMap] Standard style configuration skipped:', cfgErr);
            }
          }

          // B. Add Mapbox Terrain DEM Source & Restrained Exaggeration (1.15)
          if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', {
              type: 'raster-dem',
              url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
              tileSize: 512,
              maxzoom: 14,
            });
          }

          map.setTerrain({
            source: 'mapbox-dem',
            exaggeration: VIEWPORT_3D.terrainExaggeration,
          });

          // C. Add Georeferenced Radar Reflectivity ImageSource & Raster Layer
          if (!map.getSource(RADAR_SOURCE_ID)) {
            map.addSource(RADAR_SOURCE_ID, {
              type: 'image',
              url: getRadarFrameUrl(timeIdx),
              coordinates: BENGALURU_RADAR_BOUNDS,
            });
          }

          if (!map.getLayer(RADAR_LAYER_ID)) {
            const radarLayerConfig: any = {
              id: RADAR_LAYER_ID,
              type: 'raster',
              source: RADAR_SOURCE_ID,
              paint: {
                'raster-opacity': 0.85,
                'raster-fade-duration': 0,
              },
            };

            if (isStandardStyle) {
              // In Mapbox Standard style, slot: 'top' renders radar reflectivity above basemap and 3D buildings, below place labels
              radarLayerConfig.slot = 'top';
              map.addLayer(radarLayerConfig);
            } else {
              // Fallback for dark-v11: place below symbol labels
              const layers = map.getStyle()?.layers;
              let labelLayerId: string | undefined;
              if (layers) {
                for (const layer of layers) {
                  if (layer.type === 'symbol') {
                    labelLayerId = layer.id;
                    break;
                  }
                }
              }
              map.addLayer(radarLayerConfig, labelLayerId);
            }
          }

          // E. Phase 5: Add Storm Cell Detection & Tracking GeoJSON Source & Layers
          if (!map.getSource(STORM_CELLS_SOURCE_ID)) {
            map.addSource(STORM_CELLS_SOURCE_ID, {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [],
              },
            });
          }

          const slotConfig = isStandardStyle ? { slot: 'middle' } : {};

          // 1. Storm Cell Hull (Fill)
          if (!map.getLayer(STORM_CELLS_HULL_LAYER_ID)) {
            map.addLayer({
              id: STORM_CELLS_HULL_LAYER_ID,
              type: 'fill',
              source: STORM_CELLS_SOURCE_ID,
              filter: ['==', ['get', 'feature_type'], 'cell_hull'],
              ...slotConfig,
              paint: {
                'fill-color': [
                  'match',
                  ['get', 'intensity_class'],
                  'EXTREME', '#ef4444',
                  'SEVERE', '#f97316',
                  'STRONG', '#eab308',
                  'MODERATE', '#22c55e',
                  '#38bdf8'
                ],
                'fill-opacity': 0.22,
              },
            } as any);
          }

          // 2. Storm Cell Contour (Line)
          if (!map.getLayer(STORM_CELLS_CONTOUR_LAYER_ID)) {
            map.addLayer({
              id: STORM_CELLS_CONTOUR_LAYER_ID,
              type: 'line',
              source: STORM_CELLS_SOURCE_ID,
              filter: ['==', ['get', 'feature_type'], 'cell_hull'],
              ...slotConfig,
              paint: {
                'line-color': [
                  'match',
                  ['get', 'intensity_class'],
                  'EXTREME', '#f87171',
                  'SEVERE', '#fb923c',
                  'STRONG', '#facc15',
                  'MODERATE', '#4ade80',
                  '#38bdf8'
                ],
                'line-width': 1.6,
                'line-opacity': 0.9,
              },
            } as any);
          }

          // 3. Phase 6: +30 min Uncertainty Envelope (Fill + Line: subtlest treatment)
          if (!map.getLayer(STORM_CELLS_UNCERTAINTY_30MIN_FILL_ID)) {
            map.addLayer({
              id: STORM_CELLS_UNCERTAINTY_30MIN_FILL_ID,
              type: 'fill',
              source: STORM_CELLS_SOURCE_ID,
              filter: ['==', ['get', 'feature_type'], 'forecast_uncertainty_30min'],
              ...slotConfig,
              paint: {
                'fill-color': '#94a3b8',
                'fill-opacity': 0.05,
              },
            } as any);
          }

          if (!map.getLayer(STORM_CELLS_UNCERTAINTY_30MIN_LINE_ID)) {
            map.addLayer({
              id: STORM_CELLS_UNCERTAINTY_30MIN_LINE_ID,
              type: 'line',
              source: STORM_CELLS_SOURCE_ID,
              filter: ['==', ['get', 'feature_type'], 'forecast_uncertainty_30min'],
              ...slotConfig,
              paint: {
                'line-color': '#94a3b8',
                'line-width': 1.1,
                'line-dasharray': [2, 3],
                'line-opacity': 0.70,
              },
            } as any);
          }

          // 4. Phase 6: +15 min Uncertainty Envelope (Fill + Line: light dashed treatment)
          if (!map.getLayer(STORM_CELLS_UNCERTAINTY_15MIN_FILL_ID)) {
            map.addLayer({
              id: STORM_CELLS_UNCERTAINTY_15MIN_FILL_ID,
              type: 'fill',
              source: STORM_CELLS_SOURCE_ID,
              filter: ['==', ['get', 'feature_type'], 'forecast_uncertainty_15min'],
              ...slotConfig,
              paint: {
                'fill-color': '#38bdf8',
                'fill-opacity': 0.09,
              },
            } as any);
          }

          if (!map.getLayer(STORM_CELLS_UNCERTAINTY_15MIN_LINE_ID)) {
            map.addLayer({
              id: STORM_CELLS_UNCERTAINTY_15MIN_LINE_ID,
              type: 'line',
              source: STORM_CELLS_SOURCE_ID,
              filter: ['==', ['get', 'feature_type'], 'forecast_uncertainty_15min'],
              ...slotConfig,
              paint: {
                'line-color': '#38bdf8',
                'line-width': 1.4,
                'line-dasharray': [3, 2],
                'line-opacity': 0.85,
              },
            } as any);
          }

          // 5. Motion Vectors (Line)
          if (!map.getLayer(STORM_CELLS_VECTOR_LAYER_ID)) {
            map.addLayer({
              id: STORM_CELLS_VECTOR_LAYER_ID,
              type: 'line',
              source: STORM_CELLS_SOURCE_ID,
              filter: ['==', ['get', 'feature_type'], 'cell_vector'],
              ...slotConfig,
              paint: {
                'line-color': '#38bdf8',
                'line-width': 2.2,
                'line-dasharray': [2, 2],
                'line-opacity': 0.95,
              },
            } as any);
          }

          // 6. Centroid Points (Circle)
          if (!map.getLayer(STORM_CELLS_CENTROID_LAYER_ID)) {
            map.addLayer({
              id: STORM_CELLS_CENTROID_LAYER_ID,
              type: 'circle',
              source: STORM_CELLS_SOURCE_ID,
              filter: ['==', ['get', 'feature_type'], 'cell_centroid'],
              ...slotConfig,
              paint: {
                'circle-radius': 6,
                'circle-color': [
                  'match',
                  ['get', 'intensity_class'],
                  'EXTREME', '#ef4444',
                  'SEVERE', '#f97316',
                  'STRONG', '#eab308',
                  'MODERATE', '#22c55e',
                  '#38bdf8'
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.95,
              },
            } as any);
          }

          // 7. Centroid Labels (Symbol)
          if (!map.getLayer(STORM_CELLS_LABELS_LAYER_ID)) {
            map.addLayer({
              id: STORM_CELLS_LABELS_LAYER_ID,
              type: 'symbol',
              source: STORM_CELLS_SOURCE_ID,
              filter: ['==', ['get', 'feature_type'], 'cell_centroid'],
              ...slotConfig,
              layout: {
                'text-field': ['get', 'label_text'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'text-offset': [0, 1.4],
                'text-anchor': 'top',
                'text-allow-overlap': true,
                'text-ignore-placement': true,
              },
              paint: {
                'text-color': '#f8fafc',
                'text-halo-color': 'rgba(15, 23, 42, 0.92)',
                'text-halo-width': 2.0,
              },
            } as any);
          }

          // Operational Cell Popover with Uncertainty & Nowcast Confidence
          const showCellPopup = (lngLat: mapboxgl.LngLat, rawProps: any) => {
            const props = { ...rawProps };
            let nowcast = props.nowcast;
            if (typeof nowcast === 'string') {
              try { nowcast = JSON.parse(nowcast); } catch { nowcast = null; }
            }

            const conf = props.confidence ?? 'LOW';
            const confColor =
              conf === 'HIGH' ? '#10b981' :
              conf === 'MEDIUM' ? '#f59e0b' : '#ef4444';

            const unc15 = nowcast?.forecast_15min?.uncertainty_km ?? '—';
            const unc30 = nowcast?.forecast_30min?.uncertainty_km ?? '—';

            const popupHtml = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 11px; min-width: 240px; box-shadow: 0 8px 24px rgba(0,0,0,0.65);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 6px; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-weight: 800; color: #38bdf8; font-size: 14px; letter-spacing: 0.5px;">${props.cell_id}</span>
                    <span style="background: rgba(56, 189, 248, 0.2); padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: bold; color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.3);">${props.intensity_class}</span>
                  </div>
                  <span style="background: ${confColor}22; color: ${confColor}; border: 1px solid ${confColor}66; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: 0.5px;">
                    ${conf} CONFIDENCE
                  </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 8px; font-size: 11px;">
                  <div><span style="color: #94a3b8;">Intensity:</span> <strong style="color: #f8fafc;">${props.max_dbz} dBZ</strong></div>
                  <div><span style="color: #94a3b8;">Mean:</span> <strong style="color: #f8fafc;">${props.mean_dbz} dBZ</strong></div>
                  <div><span style="color: #94a3b8;">Area:</span> <strong style="color: #f8fafc;">${props.area_km2} km²</strong></div>
                  <div><span style="color: #94a3b8;">Status:</span> <strong style="color: ${props.status === 'GROWING' ? '#f59e0b' : '#38bdf8'}">${props.status}</strong></div>
                </div>

                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; margin-bottom: 6px;">
                  <div style="color: #94a3b8; font-size: 10px; margin-bottom: 2px;">Current Motion:</div>
                  <div style="font-weight: 600; color: #e2e8f0; font-size: 11px;">
                    ${props.speed_kmh} km/h · ${props.bearing_deg}°
                  </div>
                </div>

                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; margin-bottom: 8px; background: rgba(0,0,0,0.25); padding: 6px 8px; border-radius: 4px;">
                  <div style="color: #38bdf8; font-size: 10px; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.4px;">
                    KINEMATIC NOWCAST
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px;">
                    <span style="color: #cbd5e1;">+15 min:</span>
                    <span style="color: #94a3b8;">Uncertainty: <strong style="color: #38bdf8;">±${unc15} km</strong></span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 5px;">
                    <span style="color: #cbd5e1;">+30 min:</span>
                    <span style="color: #94a3b8;">Uncertainty: <strong style="color: #94a3b8;">±${unc30} km</strong></span>
                  </div>
                  <div style="font-size: 9px; color: #64748b; font-style: italic; line-height: 1.3;">
                    Kinematic nowcast — uncertainty increases with forecast horizon.
                  </div>
                </div>

                <div style="padding: 4px 6px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 4px; font-size: 9px; color: #fca5a5; text-align: center; font-weight: 700; letter-spacing: 0.3px;">
                  SYNTHETIC CELL TRACKING — DEMO ONLY
                </div>
              </div>
            `;
            new mapboxgl.Popup({ closeButton: true, offset: 12, className: 'vajra-storm-cell-popup' })
              .setLngLat(lngLat)
              .setHTML(popupHtml)
              .addTo(map);
          };

          map.on('click', STORM_CELLS_CENTROID_LAYER_ID, (e) => {
            if (e.features && e.features.length > 0) {
              showCellPopup(e.lngLat, e.features[0].properties);
            }
          });
          map.on('click', STORM_CELLS_HULL_LAYER_ID, (e) => {
            if (e.features && e.features.length > 0) {
              showCellPopup(e.lngLat, e.features[0].properties);
            }
          });
          map.on('mouseenter', STORM_CELLS_CENTROID_LAYER_ID, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', STORM_CELLS_CENTROID_LAYER_ID, () => {
            map.getCanvas().style.cursor = '';
          });
          map.on('mouseenter', STORM_CELLS_HULL_LAYER_ID, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', STORM_CELLS_HULL_LAYER_ID, () => {
            map.getCanvas().style.cursor = '';
          });

          // D. Fallback 3D Buildings for vector styles (e.g. dark-v11 fallback)
          if (!isStandardStyle && !map.getLayer('3d-buildings') && map.getSource('composite')) {
            const layers = map.getStyle()?.layers;
            let labelLayerId: string | undefined;
            if (layers) {
              for (const layer of layers) {
                if (layer.type === 'symbol' && (layer.layout as any)?.['text-field']) {
                  labelLayerId = layer.id;
                  break;
                }
              }
            }

            map.addLayer(
              {
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 12,
                paint: {
                  'fill-extrusion-color': '#131b2e',
                  'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12,
                    0,
                    12.5,
                    ['get', 'height'],
                  ],
                  'fill-extrusion-base': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12,
                    0,
                    12.5,
                    ['get', 'min_height'],
                  ],
                  'fill-extrusion-opacity': 0.75,
                },
              },
              labelLayerId
            );
          }
        } catch (setupErr) {
          console.warn('[VajraMap] 3D environment setup encountered non-fatal error:', setupErr);
        }
      };

      map.on('style.load', () => {
        configure3DEnvironment();
      });

      map.on('load', () => {
        setIsMapLoaded(true);
        configure3DEnvironment();
        if (onMapReadyRef.current) {
          onMapReadyRef.current(map);
        }
        map.resize();
      });

      map.on('error', (e) => {
        const errorDetail = (e as any)?.error?.message || (e as any)?.message || String(e);

        // Operational handling for radar raster loading events without crashing the map
        if (e && ((e as any).sourceId === RADAR_SOURCE_ID || errorDetail.toLowerCase().includes('radar'))) {
          console.warn('[VajraMap] Operational radar frame load warning:', errorDetail);
          return;
        }

        console.error('[VajraMap] Mapbox runtime error:', errorDetail, e);
        // Fallback to dark-v11 if standard style fails
        if (errorDetail.includes('standard')) {
          try {
            console.warn('[VajraMap] Falling back to dark-v11 basemap');
            map.setStyle(MAPBOX_STYLES.dark);
          } catch (fallbackErr) {
            console.error('[VajraMap] Fallback style failed:', fallbackErr);
          }
        }
      });

      // Resize observer to ensure map canvas automatically responds to container resizing
      const resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      });

      if (mapContainerRef.current) {
        resizeObserver.observe(mapContainerRef.current);
      }

      return () => {
        resizeObserver.disconnect();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    } catch (err) {
      console.error('[VajraMap] Failed to initialize Mapbox GL:', err);
    }
  }, []); // Run ONCE on mount; never re-run on parent state updates

  const manifestCacheRef = useRef<any[] | null>(null);

  // Prefetch full 18-frame storm cell manifest once on map load
  useEffect(() => {
    if (!isMapLoaded) return;
    fetch(getRadarCellsManifestUrl())
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((manifest) => {
        manifestCacheRef.current = manifest;
        const map = mapInstanceRef.current;
        if (map) {
          const source = map.getSource(STORM_CELLS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
          const safeIdx = Math.max(0, Math.min(17, Math.floor(timeIdx)));
          if (source && manifest[safeIdx]) {
            source.setData(manifest[safeIdx]);
          }
        }
      })
      .catch((err) => {
        console.warn('[VajraMap] Failed to prefetch storm cells manifest:', err);
      });
  }, [isMapLoaded]);

  // Synchronize radar reflectivity raster frame with timeIdx
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    const safeIdx = Math.max(0, Math.min(17, Math.floor(timeIdx)));
    const radarSource = map.getSource(RADAR_SOURCE_ID) as mapboxgl.ImageSource | undefined;
    if (radarSource && typeof radarSource.updateImage === 'function') {
      radarSource.updateImage({
        url: getRadarFrameUrl(safeIdx),
      });
    }
  }, [timeIdx, isMapLoaded]);

  // Synchronize storm cells overlay with timeIdx
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    const safeIdx = Math.max(0, Math.min(17, Math.floor(timeIdx)));
    const source = map.getSource(STORM_CELLS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    if (manifestCacheRef.current && manifestCacheRef.current[safeIdx]) {
      source.setData(manifestCacheRef.current[safeIdx]);
    } else {
      fetch(getRadarCellsUrl(safeIdx))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          source.setData(data);
        })
        .catch((err) => {
          console.warn(`[VajraMap] Failed to load storm cells for frame ${safeIdx}:`, err);
        });
    }
  }, [timeIdx, isMapLoaded]);

  // Synchronize storm cells visibility toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    const visibility = stormCellsVisible !== false ? 'visible' : 'none';
    const layers = [
      STORM_CELLS_HULL_LAYER_ID,
      STORM_CELLS_CONTOUR_LAYER_ID,
      STORM_CELLS_UNCERTAINTY_30MIN_FILL_ID,
      STORM_CELLS_UNCERTAINTY_30MIN_LINE_ID,
      STORM_CELLS_UNCERTAINTY_15MIN_FILL_ID,
      STORM_CELLS_UNCERTAINTY_15MIN_LINE_ID,
      STORM_CELLS_VECTOR_LAYER_ID,
      STORM_CELLS_CENTROID_LAYER_ID,
      STORM_CELLS_LABELS_LAYER_ID,
    ];
    for (const lid of layers) {
      if (map.getLayer(lid)) {
        map.setLayoutProperty(lid, 'visibility', visibility);
      }
    }
  }, [stormCellsVisible, isMapLoaded]);

  return (
    <div
      className={`vajra-map-wrapper ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#090d16',
        ...style,
      }}
    >
      {/* Real Mapbox GL Canvas Container */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Graceful Missing / Invalid Token Operational State */}
      {tokenMissing && (
        <div
          className="absolute inset-0 flex items-center justify-center p-6"
          style={{
            zIndex: 30,
            backgroundColor: 'rgba(10, 15, 26, 0.94)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            className="max-w-md w-full p-6 rounded-lg text-slate-200"
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div className="flex items-center gap-3 mb-3 text-amber-400">
              <KeyRound size={22} className="shrink-0" />
              <h3 className="font-semibold text-base text-slate-100 uppercase tracking-wider text-xs">
                Mapbox Access Token Required
              </h3>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              VAJRA Phase 1.5 requires a valid Mapbox Public Access Token to render the operational
              3D geographic workstation basemap.
            </p>

            <div
              className="p-3 rounded font-mono text-xs text-slate-300 mb-4 select-all"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Add this key to <span className="text-slate-200 font-mono">ui/.env.local</span> and restart the frontend server.
            </p>

            <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800">
              <span className="text-slate-500">Target Region: Bengaluru (12.9716° N, 77.5946° E)</span>
              <a
                href="https://account.mapbox.com/access-tokens/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Get Token <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Children layers/controls overlayed on map surface */}
      {children}
    </div>
  );
}
