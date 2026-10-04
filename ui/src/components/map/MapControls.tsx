"use client";
import React, { useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import { Plus, Minus, Compass, Radio, SlidersHorizontal, Crosshair } from 'lucide-react';
import {
  zoomIn,
  zoomOut,
  resetMapView,
  toggle3DView,
  RADAR_LAYER_ID,
  STORM_CELLS_HULL_LAYER_ID,
  STORM_CELLS_CONTOUR_LAYER_ID,
  STORM_CELLS_VECTOR_LAYER_ID,
  STORM_CELLS_CENTROID_LAYER_ID,
  STORM_CELLS_LABELS_LAYER_ID,
  STORM_CELLS_UNCERTAINTY_30MIN_FILL_ID,
  STORM_CELLS_UNCERTAINTY_30MIN_LINE_ID,
  STORM_CELLS_UNCERTAINTY_15MIN_FILL_ID,
  STORM_CELLS_UNCERTAINTY_15MIN_LINE_ID,
} from '@/lib/mapbox';

interface MapControlsProps {
  map: mapboxgl.Map | null;
  className?: string;
  style?: React.CSSProperties;
  onToggle3D?: (is3D: boolean) => void;
  onToggleRadar?: (visible: boolean) => void;
  onOpacityChange?: (opacity: number) => void;
  stormCellsVisible?: boolean;
  onToggleStormCells?: (visible: boolean) => void;
}

export default function MapControls({
  map,
  className = '',
  style,
  onToggle3D,
  onToggleRadar,
  onOpacityChange,
  stormCellsVisible = true,
  onToggleStormCells,
}: MapControlsProps) {
  const isReady = !!map;
  const [is3D, setIs3D] = useState<boolean>(true);
  const [isRadarVisible, setIsRadarVisible] = useState<boolean>(true);
  const [isCellsVisible, setIsCellsVisible] = useState<boolean>(stormCellsVisible);
  const [radarOpacity, setRadarOpacity] = useState<number>(85);
  const [showOpacityPopover, setShowOpacityPopover] = useState<boolean>(false);

  const handleToggleCells = () => {
    const next = !isCellsVisible;
    setIsCellsVisible(next);
    if (map) {
      const visibility = next ? 'visible' : 'none';
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
        try {
          if (map.getLayer(lid)) {
            map.setLayoutProperty(lid, 'visibility', visibility);
          }
        } catch (err) {
          console.warn('[MapControls] Layer toggle error:', err);
        }
      }
    }
    if (onToggleStormCells) {
      onToggleStormCells(next);
    }
  };

  const handleToggle3D = () => {
    if (!map) return;
    const nextIs3D = !is3D;
    setIs3D(nextIs3D);
    toggle3DView(map, nextIs3D);
    if (onToggle3D) {
      onToggle3D(nextIs3D);
    }
  };

  const handleToggleRadar = () => {
    if (!map) return;
    const next = !isRadarVisible;
    setIsRadarVisible(next);
    try {
      if (map.getLayer(RADAR_LAYER_ID)) {
        map.setLayoutProperty(RADAR_LAYER_ID, 'visibility', next ? 'visible' : 'none');
      }
    } catch (err) {
      console.warn('[MapControls] Failed to toggle radar layer visibility:', err);
    }
    if (onToggleRadar) {
      onToggleRadar(next);
    }
  };

  const handleOpacityChange = (val: number) => {
    setRadarOpacity(val);
    if (!map) return;
    try {
      if (map.getLayer(RADAR_LAYER_ID)) {
        map.setPaintProperty(RADAR_LAYER_ID, 'raster-opacity', val / 100);
      }
    } catch (err) {
      console.warn('[MapControls] Failed to update radar opacity:', err);
    }
    if (onOpacityChange) {
      onOpacityChange(val);
    }
  };

  const handleReset = () => {
    if (!map) return;
    resetMapView(map, is3D);
  };

  return (
    <div
      className={`map-controls-panel ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        background: 'rgba(15, 23, 42, 0.90)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
        zIndex: 20,
        userSelect: 'none',
        ...style,
      }}
      aria-label="Map Navigation Controls"
    >
      {/* Zoom In */}
      <button
        type="button"
        onClick={() => map && zoomIn(map)}
        disabled={!isReady}
        title="Zoom In"
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.04)',
          border: 'none',
          borderRadius: '6px',
          color: isReady ? '#e2e8f0' : '#64748b',
          cursor: isReady ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (isReady) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
        }}
      >
        <Plus size={16} />
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={() => map && zoomOut(map)}
        disabled={!isReady}
        title="Zoom Out"
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.04)',
          border: 'none',
          borderRadius: '6px',
          color: isReady ? '#e2e8f0' : '#64748b',
          cursor: isReady ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (isReady) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
        }}
      >
        <Minus size={16} />
      </button>

      <div
        style={{
          height: '1px',
          background: 'rgba(255, 255, 255, 0.1)',
          margin: '2px 4px',
        }}
      />

      {/* 3D / 2D Perspective Toggle */}
      <button
        type="button"
        onClick={handleToggle3D}
        disabled={!isReady}
        title={is3D ? "Switch to 2D Top-Down View" : "Switch to 3D Oblique View"}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: is3D ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)',
          border: is3D ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
          borderRadius: '6px',
          color: isReady ? (is3D ? '#38bdf8' : '#94a3b8') : '#64748b',
          cursor: isReady ? 'pointer' : 'not-allowed',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.5px',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          if (isReady) {
            e.currentTarget.style.background = is3D ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.12)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = is3D ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)';
        }}
      >
        {is3D ? '3D' : '2D'}
      </button>

      {/* Radar Reflectivity Overlay Visibility Toggle */}
      <button
        type="button"
        onClick={handleToggleRadar}
        disabled={!isReady}
        title={isRadarVisible ? "Hide Radar Reflectivity Layer" : "Show Radar Reflectivity Layer"}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: isRadarVisible ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)',
          border: isRadarVisible ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
          borderRadius: '6px',
          color: isReady ? (isRadarVisible ? '#38bdf8' : '#94a3b8') : '#64748b',
          cursor: isReady ? 'pointer' : 'not-allowed',
          fontSize: '9px',
          fontWeight: 800,
          letterSpacing: '0.4px',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          if (isReady) {
            e.currentTarget.style.background = isRadarVisible ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.12)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isRadarVisible ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)';
        }}
      >
        <Radio size={14} />
      </button>

      {/* Radar Opacity Adjustment Button */}
      <button
        type="button"
        onClick={() => setShowOpacityPopover(!showOpacityPopover)}
        disabled={!isReady || !isRadarVisible}
        title={`Adjust Radar Reflectivity Opacity (${radarOpacity}%)`}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: showOpacityPopover ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.04)',
          border: showOpacityPopover ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
          borderRadius: '6px',
          color: isReady && isRadarVisible ? (showOpacityPopover ? '#38bdf8' : '#94a3b8') : '#475569',
          cursor: isReady && isRadarVisible ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          if (isReady && isRadarVisible) {
            e.currentTarget.style.background = showOpacityPopover ? 'rgba(56, 189, 248, 0.28)' : 'rgba(255, 255, 255, 0.12)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = showOpacityPopover ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.04)';
        }}
      >
        <SlidersHorizontal size={14} />
      </button>

      {/* Storm Cell Tracking Toggle (Synthetic Demo) */}
      <button
        type="button"
        onClick={handleToggleCells}
        disabled={!isReady}
        title={isCellsVisible ? "Hide Storm Cells Tracking (Synthetic Demo)" : "Show Storm Cells Tracking (Synthetic Demo)"}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: isCellsVisible ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)',
          border: isCellsVisible ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
          borderRadius: '6px',
          color: isReady ? (isCellsVisible ? '#38bdf8' : '#94a3b8') : '#64748b',
          cursor: isReady ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          if (isReady) {
            e.currentTarget.style.background = isCellsVisible ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.12)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isCellsVisible ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)';
        }}
      >
        <Crosshair size={14} />
      </button>

      {/* Flyout Opacity Slider Popover */}
      {showOpacityPopover && (
        <div
          style={{
            position: 'absolute',
            left: '46px',
            top: '140px',
            width: '160px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 35,
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.5px' }}>
            <span>RADAR OPACITY</span>
            <span style={{ color: '#38bdf8' }}>{radarOpacity}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={radarOpacity}
            onChange={(e) => handleOpacityChange(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#38bdf8',
              height: '4px',
              cursor: 'pointer',
            }}
          />
        </div>
      )}

      {/* Reset to Bengaluru View */}
      <button
        type="button"
        onClick={handleReset}
        disabled={!isReady}
        title="Reset to Bengaluru Center"
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.04)',
          border: 'none',
          borderRadius: '6px',
          color: isReady ? '#38bdf8' : '#64748b',
          cursor: isReady ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (isReady) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.18)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
        }}
      >
        <Compass size={16} />
      </button>
    </div>
  );
}
