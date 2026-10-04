"use client";
import React from 'react';
import { Activity } from 'lucide-react';

interface MapLegendProps {
  className?: string;
  style?: React.CSSProperties;
  sourceDisclosure?: string;
  isSynthetic?: boolean;
}

/**
 * Operational Meteorological Radar Reflectivity Legend (dBZ)
 * Matches backend colormap progression (10 to 65+ dBZ)
 */
const DBZ_BANDS = [
  { dbz: '10', color: '#00ebeb', label: '10' },
  { dbz: '20', color: '#1ea0ff', label: '20' },
  { dbz: '30', color: '#00e132', label: '30' },
  { dbz: '40', color: '#ffe600', label: '40' },
  { dbz: '50', color: '#ff7d00', label: '50' },
  { dbz: '60', color: '#ff1e1e', label: '60' },
  { dbz: '65+', color: '#d20028', label: '65+' },
];

export default function MapLegend({ 
  className = '', 
  style,
  sourceDisclosure,
  isSynthetic = true
}: MapLegendProps) {
  return (
    <div
      className={`map-legend-panel ${className}`}
      style={{
        background: 'rgba(15, 23, 42, 0.90)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
        fontSize: '11px',
        color: '#94a3b8',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '220px',
        zIndex: 20,
        ...style,
      }}
      aria-label="Radar Reflectivity dBZ Legend"
    >
      {/* Legend Title & Units */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={13} color="#38bdf8" />
          <span style={{ fontWeight: 700, letterSpacing: '0.6px', color: '#e2e8f0', fontSize: '10px' }}>
            RADAR REFLECTIVITY
          </span>
        </div>
        <span style={{ fontSize: '9px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.4px' }}>
          dBZ
        </span>
      </div>

      {/* Discrete Segmented Reflectivity Ramp */}
      <div
        style={{
          display: 'flex',
          height: '8px',
          borderRadius: '3px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {DBZ_BANDS.map((band) => (
          <div
            key={band.dbz}
            style={{
              flex: 1,
              backgroundColor: band.color,
            }}
            title={`${band.dbz} dBZ`}
          />
        ))}
      </div>

      {/* Numerical dBZ Tick Marks */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '9px',
          fontWeight: 600,
          color: '#94a3b8',
          padding: '0 1px',
        }}
      >
        {DBZ_BANDS.map((band) => (
          <span key={band.dbz} style={{ textAlign: 'center' }}>
            {band.label}
          </span>
        ))}
      </div>

      {/* Meteorological Intensity Scale Labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '8px',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          paddingTop: '2px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <span>Light</span>
        <span>Moderate</span>
        <span>Severe / Core</span>
      </div>

      {/* Phase 6: Storm Cell Tracking & Nowcast Uncertainty Legend */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '6px',
          marginTop: '2px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
        }}
      >
        <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.5px' }}>
          STORM CELL NOWCAST
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '9px', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(56, 189, 248, 0.3)', border: '1px solid #38bdf8' }} />
            <span>Observed Cell</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '0px', borderTop: '2px dashed #38bdf8' }} />
            <span>Projected Path</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', border: '1px dashed #38bdf8' }} />
            <span>15-min Uncertainty</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(148, 163, 184, 0.10)', border: '1px dashed #94a3b8' }} />
            <span>30-min Uncertainty</span>
          </div>
        </div>
      </div>

      {/* Phase 7: Operational Data Source Disclosure */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '5px',
          marginTop: '2px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '8px',
        }}
      >
        <span style={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
          DATA SOURCE
        </span>
        <span
          style={{
            color: isSynthetic !== false ? '#fbbf24' : '#38bdf8',
            fontWeight: 700,
            letterSpacing: '0.3px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: isSynthetic !== false ? '#fbbf24' : '#22c55e',
              display: 'inline-block',
            }}
          />
          {sourceDisclosure || 'SYNTHETIC • DEMO'}
        </span>
      </div>
    </div>
  );
}
