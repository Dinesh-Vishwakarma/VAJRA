"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  ArrowLeft, 
  Plane, 
  Wind, 
  AlertTriangle, 
  CheckCircle, 
  Compass, 
  Eye, 
  CloudLightning, 
  ShieldAlert, 
  Navigation,
  RefreshCw
} from 'lucide-react';
import { fetchAviationAirports } from '@/lib/api';

export default function AviationPage() {
  const [selectedAirport, setSelectedAirport] = useState<'VOBL' | 'VIDP' | 'VABB'>('VOBL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [airports, setAirports] = useState<Record<string, any>>({
    'VOBL': {
      code: 'VOBL',
      name: 'Kempegowda International Airport (Bengaluru)',
      metarRaw: 'VOBL 291830Z 25022G38KT 2400 +TSRA SCT012CB BKN025 21/20 Q1011 TEMPO 1200 +TSRA',
      status: 'Warning: Convective Microburst Near Threshold',
      alertLevel: 'Severe',
      diversionRisk: '58%',
      runways: [
        { id: '09L/27R', heading: '090° / 270°', wind: '250° at 22kt G38kt', crosswind: '21 kt', microburst: 'ALERT: -18kt Loss on 3nm Final', status: 'Go-Around Advisory', color: '#ef4444' },
        { id: '09R/27L', heading: '090° / 270°', wind: '240° at 16kt G28kt', crosswind: '14 kt', microburst: 'Nominal Inflow (No Shear)', status: 'Active Departures', color: '#10B981' }
      ],
      waypoints: [
        { name: 'LEKOP (North Gate)', status: 'Closed (CB Cell 60 dBZ)', delay: '+25m' },
        { name: 'GUNIM (East Gate)', status: 'Clear Corridor', delay: 'On-Time' },
        { name: 'TELKO (South Gate)', status: 'Turbulence Advisory', delay: '+10m' },
        { name: 'BIA VOR (Holding Stack)', status: 'Stall Risk: FL140-FL180', delay: 'Holding' }
      ]
    },
    'VIDP': {
      code: 'VIDP',
      name: 'Indira Gandhi International Airport (Delhi)',
      metarRaw: 'VIDP 291800Z 08012KT 4000 HZ FEW040 BKN100 32/22 Q1006 NOSIG',
      status: 'Normal Operations (Haze / VFR Transition)',
      alertLevel: 'Normal',
      diversionRisk: '8%',
      runways: [
        { id: '10/28', heading: '100° / 280°', wind: '080° at 12kt', crosswind: '4 kt', microburst: 'Nominal', status: 'Full Operations', color: '#10B981' },
        { id: '11L/29R', heading: '110° / 290°', wind: '080° at 12kt', crosswind: '6 kt', microburst: 'Nominal', status: 'Full Operations', color: '#10B981' },
        { id: '11R/29L', heading: '110° / 290°', wind: '080° at 12kt', crosswind: '6 kt', microburst: 'Nominal', status: 'Full Operations', color: '#10B981' }
      ],
      waypoints: [
        { name: 'ALI (Holding)', status: 'Normal Flow', delay: 'On-Time' },
        { name: 'DRA (South Gate)', status: 'Normal Flow', delay: 'On-Time' },
        { name: 'DGC (West Gate)', status: 'Clear', delay: 'On-Time' }
      ]
    },
    'VABB': {
      code: 'VABB',
      name: 'Chhatrapati Shivaji Maharaj International (Mumbai)',
      metarRaw: 'VABB 291815Z 27018KT 3000 -RA SCT018 BKN030 27/25 Q1009 TEMPO 1500 SHRA',
      status: 'Monsoon Gusting & Crosswind Alert',
      alertLevel: 'Moderate',
      diversionRisk: '24%',
      runways: [
        { id: '09/27', heading: '090° / 270°', wind: '270° at 18kt', crosswind: '0 kt (Direct Headwind)', microburst: 'Wet Runway Braking Fair', status: 'Active Landing', color: '#10B981' },
        { id: '14/32', heading: '140° / 320°', wind: '270° at 18kt', crosswind: '17 kt Crosswind', microburst: 'Moderate Shear', status: 'Secondary Only', color: '#f59e0b' }
      ],
      waypoints: [
        { name: 'BOM VOR', status: 'Holding Stack FL120', delay: '+15m' },
        { name: 'APANO', status: 'Rainband Crossing', delay: '+10m' },
        { name: 'EXOLU', status: 'Clear Oceanic', delay: 'On-Time' }
      ]
    }
  });

  const loadAviationData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAviationAirports();
      if (data && Object.keys(data).length > 0) {
        setAirports(data);
      }
    } catch (err) {
      console.error('Error loading aviation telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAviationData();
  }, []);

  const current = airports[selectedAirport] || airports['VOBL'];

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
            onClick={loadAviationData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <RefreshCw size={13} className={isLoading ? 'spin-animation' : ''} /> Refresh Exercise METAR
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: current.alertLevel === 'Severe' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)', border: `1px solid ${current.alertLevel === 'Severe' ? '#ef4444' : '#10B981'}`, padding: '6px 14px', borderRadius: '20px', fontSize: '12px', color: current.alertLevel === 'Severe' ? '#ef4444' : '#10B981', fontWeight: 600 }}>
            <Plane size={14} /> ATC Terminal Weather • Scenario Demo
          </span>
        </div>
      </div>

      {/* Honest Data Status Banner */}
      <div style={{ padding: '10px 16px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '10px', marginBottom: '24px', fontSize: '12px', color: '#bae6fd', display: 'flex', alignItems: 'center', gap: '10px', lineHeight: 1.5 }}>
        <AlertTriangle size={16} className="shrink-0 text-sky-400" />
        <div>
          <strong style={{ color: '#38bdf8' }}>EXERCISE SCENARIO DATA — NOT FOR OPERATIONAL FLIGHT DISPATCH:</strong> METAR observations, microburst warnings, and runway shear alerts are offline historical/simulated exercise scenarios. No real-time AFTN/AMHS connection is active.
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '30px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Plane size={30} color="var(--color-precip)" /> Aviation Terminal Weather &amp; Runway Safety
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>
          Microburst detection, runway low-level wind shear (LLWS), flight corridor holding stack risk, and live METAR / TAF decoding.
        </p>
      </div>

      {/* Airport Switcher Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {Object.keys(airports).map(code => (
          <button
            key={code}
            onClick={() => setSelectedAirport(code as any)}
            style={{
              padding: '12px 18px',
              borderRadius: '10px',
              border: selectedAirport === code ? '1px solid var(--color-precip)' : '1px solid var(--border-color)',
              background: selectedAirport === code ? 'rgba(0, 180, 255, 0.15)' : 'rgba(255,255,255,0.04)',
              color: selectedAirport === code ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: selectedAirport === code ? 'var(--color-precip)' : 'var(--text-primary)' }}>
              {code}
            </span>
            <span style={{ fontSize: '12px' }}>{airports[code].name}</span>
          </button>
        ))}
      </div>

      {/* Airport Status Hero Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px', borderLeft: `4px solid ${current.alertLevel === 'Severe' ? '#ef4444' : '#10B981'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{current.name}</span>
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px', background: current.alertLevel === 'Severe' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: current.alertLevel === 'Severe' ? '#ef4444' : '#10B981', fontWeight: 600 }}>
                {current.status}
              </span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#93C5FD', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', marginTop: '8px' }}>
              METAR: {current.metarRaw}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Flight Diversion Probability</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: current.alertLevel === 'Severe' ? '#ef4444' : '#10B981' }}>
              {current.diversionRisk}
            </div>
          </div>
        </div>
      </div>

      {/* Runway Safety & Corridor Feeds */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px' }}>
        
        {/* Active Runway Status */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={20} color="var(--color-precip)" /> Runway Operations &amp; Wind Shear Analysis
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {current.runways.map((r: any, i: number) => (
              <div key={i} style={{ padding: '16px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${r.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Runway {r.id} ({r.heading})</span>
                  <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: `${r.color}20`, color: r.color, fontWeight: 600 }}>
                    {r.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginTop: '8px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Surface Wind: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{r.wind}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Crosswind Component: </span>
                    <strong style={{ color: r.crosswind.includes('21') ? '#ef4444' : '#f59e0b' }}>{r.crosswind}</strong>
                  </div>
                </div>

                <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', background: `${r.color}15`, color: r.color, fontSize: '12px', fontWeight: 600 }}>
                  &bull; {r.microburst}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inbound Flight Corridor Waypoints */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={20} color="var(--color-warning)" /> Inbound Gate Convective Gates
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {current.waypoints.map((wp: any, i: number) => (
              <div key={i} style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{wp.name}</div>
                  <div style={{ fontSize: '11px', color: wp.status.includes('Closed') ? '#ef4444' : 'var(--text-secondary)' }}>
                    {wp.status}
                  </div>
                </div>

                <span style={{ fontSize: '12px', fontWeight: 'bold', color: wp.delay.includes('+') ? '#f59e0b' : wp.delay === 'Holding' ? '#ef4444' : '#10B981' }}>
                  {wp.delay}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
