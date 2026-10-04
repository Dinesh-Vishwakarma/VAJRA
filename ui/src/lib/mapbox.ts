/**
 * VAJRA Mapbox Configuration & Constants
 * Phase 1.5 — 3D Meteorological/GIS Workstation Foundation
 */
import type mapboxgl from 'mapbox-gl';
import { getApiBaseUrl } from './api';

/**
 * Canonical Bengaluru Radar Spatial Extent (DWR Bengaluru Grid)
 * 4-corner bounding quad in exact Mapbox ImageSource ordering: [NW, NE, SE, SW]
 */
export const BENGALURU_RADAR_BOUNDS: [
  [number, number],
  [number, number],
  [number, number],
  [number, number]
] = [
  [77.3446, 13.1916], // Northwest
  [77.8446, 13.1916], // Northeast
  [77.8446, 12.7516], // Southeast
  [77.3446, 12.7516], // Southwest
];

export const RADAR_SOURCE_ID = 'radar-source';
export const RADAR_LAYER_ID = 'radar-layer';
export const RADAR_FRAME_COUNT = 18;
export const RADAR_INTERVAL_MINUTES = 5;

// Phase 5: Storm Cell Detection & Tracking IDs
export const STORM_CELLS_SOURCE_ID = 'storm-cells-source';
export const STORM_CELLS_HULL_LAYER_ID = 'storm-cells-hull';
export const STORM_CELLS_CONTOUR_LAYER_ID = 'storm-cells-contour';
export const STORM_CELLS_VECTOR_LAYER_ID = 'storm-cells-vector';
export const STORM_CELLS_CENTROID_LAYER_ID = 'storm-cells-centroid';
export const STORM_CELLS_LABELS_LAYER_ID = 'storm-cells-labels';

// Phase 6: Uncertainty & Nowcast Confidence Layer IDs
export const STORM_CELLS_UNCERTAINTY_30MIN_FILL_ID = 'storm-cells-unc-30m-fill';
export const STORM_CELLS_UNCERTAINTY_30MIN_LINE_ID = 'storm-cells-unc-30m-line';
export const STORM_CELLS_UNCERTAINTY_15MIN_FILL_ID = 'storm-cells-unc-15m-fill';
export const STORM_CELLS_UNCERTAINTY_15MIN_LINE_ID = 'storm-cells-unc-15m-line';

/**
 * Constructs the canonical radar frame endpoint URL using the configured API base.
 */
export function getRadarFrameUrl(timeIdx: number): string {
  const safeIdx = Math.max(0, Math.min(17, Math.floor(timeIdx)));
  return `${getApiBaseUrl()}/api/radar/frame/${safeIdx}`;
}

/**
 * Constructs the canonical radar storm cells GeoJSON endpoint URL.
 */
export function getRadarCellsUrl(timeIdx: number): string {
  const safeIdx = Math.max(0, Math.floor(timeIdx));
  return `${getApiBaseUrl()}/api/radar/cells/${safeIdx}`;
}


/**
 * Constructs the canonical radar storm cells manifest endpoint URL.
 */
export function getRadarCellsManifestUrl(): string {
  return `${getApiBaseUrl()}/api/radar/cells`;
}

/**
 * Constructs the canonical radar metadata endpoint URL (Phase 7).
 */
export function getRadarMetadataUrl(): string {
  return `${getApiBaseUrl()}/api/radar/metadata`;
}


/**
 * Geographic Viewport Configuration for Bengaluru Target Grid
 */
export interface MapViewportConfig {
  center: [number, number]; // [longitude, latitude]
  zoom: number;
  pitch: number;
  bearing: number;
  minZoom: number;
  maxZoom: number;
  terrainExaggeration?: number;
}

export const BENGALURU_COORDINATES: [number, number] = [77.5946, 12.9716];

/**
 * 3D Oblique Viewport (Operational Meteorological Workstation)
 */
export const VIEWPORT_3D = {
  center: BENGALURU_COORDINATES,
  zoom: 11.0,
  pitch: 50,
  bearing: 15,
  minZoom: 4,
  maxZoom: 18,
  terrainExaggeration: 1.15,
} as const;

/**
 * 2D Top-Down Viewport (Planar Nadir Inspection)
 */
export const VIEWPORT_2D = {
  center: BENGALURU_COORDINATES,
  zoom: 11.0,
  pitch: 0,
  bearing: 0,
  minZoom: 4,
  maxZoom: 18,
  terrainExaggeration: 0,
} as const;

export const DEFAULT_VIEWPORT: MapViewportConfig = {
  center: BENGALURU_COORDINATES,
  zoom: 11.0,
  pitch: 50,
  bearing: 15,
  minZoom: 4,
  maxZoom: 18,
  terrainExaggeration: 1.15,
};

/**
 * Basemap Styling
 * Mapbox Standard provides built-in 3D architecture with nocturnal lightPreset.
 * Dark-v11 serves as trusted fallback with vector-extrusion buildings.
 */
export const MAPBOX_STYLES = {
  standard: 'mapbox://styles/mapbox/standard',
  dark: 'mapbox://styles/mapbox/dark-v11',
  darkWorkstation: 'mapbox://styles/mapbox/navigation-night-v1',
} as const;

export const DEFAULT_BASEMAP_STYLE = MAPBOX_STYLES.standard;

/**
 * Token Retrieval & Validation
 * Safely fetches token from public environment variables.
 */
export function getMapboxToken(): string {
  const token = (
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.NEXT_MAPBOX_TOKEN ||
    ''
  ).trim();

  // Guard against known example placeholder strings
  if (
    !token ||
    token.includes('example') ||
    token.includes('your_mapbox_token_here') ||
    !token.startsWith('pk.')
  ) {
    return '';
  }

  // Gracefully handle accidental double prefix (e.g. pk.pk.eyJ1...)
  if (token.startsWith('pk.pk.')) {
    return token.substring(3);
  }

  return token;
}

/**
 * Camera & 3D Navigation Helpers
 */
export function toggle3DView(map: mapboxgl.Map, enable3D: boolean): void {
  if (!map) return;
  try {
    if (enable3D) {
      map.easeTo({
        pitch: VIEWPORT_3D.pitch,
        bearing: VIEWPORT_3D.bearing,
        duration: 900,
        essential: true,
      });
      if (map.getSource('mapbox-dem')) {
        map.setTerrain({
          source: 'mapbox-dem',
          exaggeration: VIEWPORT_3D.terrainExaggeration,
        });
      }
    } else {
      map.easeTo({
        pitch: VIEWPORT_2D.pitch,
        bearing: VIEWPORT_2D.bearing,
        duration: 900,
        essential: true,
      });
      // Flatten terrain in 2D nadir mode
      map.setTerrain(null);
    }
  } catch (err) {
    console.warn('[VajraMap] Failed to toggle 3D view:', err);
  }
}

export function resetMapView(map: mapboxgl.Map, is3D: boolean = true): void {
  if (!map) return;
  map.flyTo({
    center: DEFAULT_VIEWPORT.center,
    zoom: DEFAULT_VIEWPORT.zoom,
    pitch: is3D ? VIEWPORT_3D.pitch : VIEWPORT_2D.pitch,
    bearing: is3D ? VIEWPORT_3D.bearing : VIEWPORT_2D.bearing,
    essential: true,
    duration: 1200,
  });
}

export function zoomIn(map: mapboxgl.Map): void {
  if (!map) return;
  map.zoomIn({ duration: 300 });
}

export function zoomOut(map: mapboxgl.Map): void {
  if (!map) return;
  map.zoomOut({ duration: 300 });
}

/**
 * Future Weather Layers Architecture (Contract Placeholders for Phase 2+)
 */
export type WeatherLayerType = 'none' | 'radar_reflectivity' | 'satellite_ir' | 'storm_cells';

export interface WeatherLayerConfig {
  id: string;
  type: WeatherLayerType;
  visible: boolean;
  opacity: number;
}
