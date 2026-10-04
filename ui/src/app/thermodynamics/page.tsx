"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  ArrowLeft, 
  Thermometer, 
  Wind, 
  CloudRain, 
  Compass, 
  Gauge, 
  Activity, 
  AlertOctagon, 
  Layers, 
  ChevronRight,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { fetchSoundingProfile, fetchStationIndices } from '@/lib/api';

export default function ThermodynamicsPage() {
  const [activeStation, setActiveStation] = useState<'blr-sounding' | 'del-sounding' | 'mum-sounding'>('blr-sounding');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [soundingProfiles, setSoundingProfiles] = useState<any[]>([
    { pressure: 1000, altitude: 0.9, temp: 28.4, dewpoint: 23.2, parcel: 28.4 },
    { pressure: 925, altitude: 1.5, temp: 22.8, dewpoint: 20.1, parcel: 24.2 },
    { pressure: 850, altitude: 2.2, temp: 18.0, dewpoint: 16.5, parcel: 20.8 },
    { pressure: 700, altitude: 3.8, temp: 9.4, dewpoint: 6.2, parcel: 14.5 },
    { pressure: 500, altitude: 6.2, temp: -5.8, dewpoint: -11.2, parcel: 2.6 },
    { pressure: 400, altitude: 7.8, temp: -16.5, dewpoint: -24.0, parcel: -8.1 },
    { pressure: 300, altitude: 9.8, temp: -32.0, dewpoint: -42.0, parcel: -24.2 },
    { pressure: 250, altitude: 11.2, temp: -42.5, dewpoint: -55.0, parcel: -36.0 },
    { pressure: 200, altitude: 12.8, temp: -54.0, dewpoint: -68.0, parcel: -52.4 },
    { pressure: 150, altitude: 14.6, temp: -66.5, dewpoint: -79.0, parcel: -67.8 },
    { pressure: 100, altitude: 16.8, temp: -74.2, dewpoint: -88.0, parcel: -82.0 },
  ]);

  const [indices, setIndices] = useState<any[]>([
    { name: 'SBCAPE', value: '1,850 J/kg', desc: 'Surface-Based Convective Available Potential Energy', severity: 'Extreme', color: '#ef4444' },
    { name: 'MUCAPE', value: '2,240 J/kg', desc: 'Most Unstable Parcel Buoyant Energy', severity: 'Extreme', color: '#ef4444' },
    { name: 'CIN', value: '-18 J/kg', desc: 'Convective Inhibition (Inversion Cap broken)', severity: 'Favorable', color: '#10B981' },
    { name: 'Lifted Index (LI)', value: '-6.4', desc: '500 hPa Parcel Thermal Deficit', severity: 'Severe', color: '#ef4444' },
    { name: '0-6km Bulk Shear', value: '42 knots', desc: 'Deep Layer Wind Shear for Storm Organization', severity: 'High', color: '#f59e0b' },
    { name: 'SRH 0-3km', value: '210 m²/s²', desc: 'Storm Relative Helicity (Mesocyclone Potential)', severity: 'Severe', color: '#ef4444' },
    { name: 'K-Index', value: '38.5', desc: 'Air-Mass Thunderstorm Potential', severity: 'High', color: '#f59e0b' },
    { name: 'PWAT', value: '58.2 mm', desc: 'Precipitable Water Vapor in Atmospheric Column', severity: 'Torrential', color: '#3B82F6' },
  ]);

  const verticalLevels = [
    { level: 'EL (Equilibrium Level)', hpa: '165 hPa', alt: '13.8 km', desc: 'Storm Anvil / Overshooting Convective Top' },
    { level: 'Freezing Level (0°C Isotherm)', hpa: '580 hPa', alt: '4.8 km', desc: 'Hail Growth Zone & Melting Layer Bright Band' },
    { level: 'LFC (Level of Free Convection)', hpa: '840 hPa', alt: '1.6 km', desc: 'Spontaneous Updraft Acceleration Level' },
    { level: 'LCL (Lifted Condensation Level)', hpa: '920 hPa', alt: '0.8 km', desc: 'Cloud Base / Ground Moisture Saturation' },
  ];

  const loadSoundingData = async () => {
    setIsLoading(true);
    try {
      const [profileData, indicesData] = await Promise.all([
        fetchSoundingProfile(activeStation),
        fetchStationIndices(activeStation)
      ]);
      if (profileData && profileData.length > 0) setSoundingProfiles(profileData);
      if (indicesData && indicesData.length > 0) setIndices(indicesData);
    } catch (err) {
      console.error('Error fetching sounding:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSoundingData();
  }, [activeStation]);

  return (
    <div className="page-container" style={{ maxWidth: '1360px', padding: '24px 28px 100px' }}>
      <Navbar />
      {/* Top Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Link href="/" className="nav-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <ArrowLeft size={18} /> Back to Live Radar Command Center
        </Link>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={loadSoundingData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <RefreshCw size={13} className={isLoading ? 'spin-animation' : ''} /> Refresh Profile
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', color: '#fcd34d', fontWeight: 600 }}>
            <AlertOctagon size={14} /> Climatological Profile • Demo Sounding
          </span>
        </div>
      </div>

      {/* Honest Data Status Banner */}
      <div style={{ padding: '10px 16px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '10px', marginBottom: '24px', fontSize: '12px', color: '#bae6fd', display: 'flex', alignItems: 'center', gap: '10px', lineHeight: 1.5 }}>
        <AlertTriangle size={16} className="shrink-0 text-sky-400" />
        <div>
          <strong style={{ color: '#38bdf8' }}>SYNTHETIC THERMODYNAMIC SOUNDING (DEMO):</strong> Atmospheric profile indices (SBCAPE 1,850 J/kg, PWAT 58.2 mm) and Skew-T levels are simulated climatological profiles representing severe convective environments. No live IMD radiosonde feed is connected.
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '30px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Thermometer size={30} color="#f59e0b" /> Vertical Atmospheric Soundings &amp; Thermodynamics
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>
          Deep-column thermodynamic profile (Skew-T Log-P) and kinematic wind shear analysis driving VAJRA convective initiation nowcasts.
        </p>
      </div>

      {/* Station Selector Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {[
          { id: 'blr-sounding', label: 'Bengaluru (DWR / Radiosonde 43295)', status: 'CAPE: 1850 J/kg' },
          { id: 'del-sounding', label: 'Delhi-NCR (Safdarjung 42182)', status: 'CAPE: 1200 J/kg' },
          { id: 'mum-sounding', label: 'Mumbai (Santacruz 43003)', status: 'CAPE: 2400 J/kg' },
        ].map(st => (
          <button
            key={st.id}
            onClick={() => setActiveStation(st.id as any)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: activeStation === st.id ? '1px solid var(--color-precip)' : '1px solid var(--border-color)',
              background: activeStation === st.id ? 'rgba(0, 180, 255, 0.15)' : 'rgba(255,255,255,0.04)',
              color: activeStation === st.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <span>{st.label}</span>
            <span style={{ fontSize: '11px', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              {st.status}
            </span>
          </button>
        ))}
      </div>

      {/* Sounding Skew-T Plot + Atmospheric Inversion Indices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px', marginBottom: '28px' }}>
        
        {/* Skew-T Emulation Plot */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="var(--color-precip)" /> Deep-Troposphere Thermodynamic Profile
            </h2>
            <div style={{ display: 'flex', gap: '14px', fontSize: '12px' }}>
              <span style={{ color: '#ef4444' }}>&bull; Ambient Temp (T)</span>
              <span style={{ color: '#10B981' }}>&bull; Dewpoint (Td)</span>
              <span style={{ color: '#f59e0b' }}>&bull; Lifted Parcel (Tp)</span>
            </div>
          </div>

          <div style={{ height: '340px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={soundingProfiles} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="pressure" reversed unit=" hPa" stroke="var(--text-secondary)" fontSize={11} />
                <YAxis unit="°C" stroke="var(--text-secondary)" fontSize={11} domain={[-90, 40]} />
                <Tooltip 
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  labelFormatter={(v) => `Pressure: ${v} hPa`}
                />
                <Line type="monotone" dataKey="temp" stroke="#ef4444" strokeWidth={2.5} dot={false} name="Temperature" />
                <Line type="monotone" dataKey="dewpoint" stroke="#10B981" strokeWidth={2.5} dot={false} name="Dewpoint" />
                <Line type="monotone" dataKey="parcel" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Lifted Parcel" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Positive area between Parcel (Yellow) and Temp (Red) represents CAPE (Convective Available Potential Energy).
          </div>
        </div>

        {/* Thermodynamic Instability Indices */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gauge size={20} color="var(--color-warning)" /> Severe Weather Instability Indices
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {indices.map((idx, i) => (
              <div key={i} style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: `3px solid ${idx.color}` }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{idx.name}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: idx.color, margin: '2px 0' }}>{idx.value}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.2 }}>{idx.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Vertical Layers */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="#10B981" /> Critical Convective Atmospheric Boundaries
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {verticalLevels.map((lvl, i) => (
            <div key={i} style={{ padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{lvl.level}</strong>
                <span style={{ fontSize: '12px', color: 'var(--color-precip)', fontWeight: 'bold' }}>{lvl.alt}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pressure: {lvl.hpa}</div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{lvl.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
