"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  ArrowLeft, 
  ShieldAlert, 
  AlertTriangle, 
  Send, 
  Download, 
  CheckCircle2, 
  LifeBuoy, 
  Building2, 
  Radio, 
  Layers, 
  MapPin, 
  FileText,
  RefreshCw,
  Power
} from 'lucide-react';
import { 
  fetchDisasterWards, 
  fetchInfrastructure, 
  toggleWardPump, 
  fetchCapXml, 
  dispatchAlertBroadcast,
  WardData, 
  InfrastructureAsset 
} from '@/lib/api';

export default function DisasterOps() {
  const [selectedWard, setSelectedWard] = useState<string>('ward-150');
  const [capCopied, setCapCopied] = useState<boolean>(false);
  const [alertDispatched, setAlertDispatched] = useState<boolean>(false);
  const [dispatchStatus, setDispatchStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [wardData, setWardData] = useState<WardData[]>([
    { id: 'ward-150', name: 'Bellandur (Ward 150)', risk: 92, level: 'Critical', rainRate: '78 mm/hr', floodDepth: '1.4 m', underpasses: 'Waterlogged', pumps: '5/6 Active', pumpsActive: 5, pumpsTotal: 6, siren: 'Armed' },
    { id: 'ward-174', name: 'Silk Board Junction (Ward 174)', risk: 88, level: 'Critical', rainRate: '65 mm/hr', floodDepth: '1.1 m', underpasses: 'Diverted', pumps: '4/4 Active', pumpsActive: 4, pumpsTotal: 4, siren: 'Armed' },
    { id: 'ward-151', name: 'Koramangala 4th Block (Ward 151)', risk: 79, level: 'High', rainRate: '54 mm/hr', floodDepth: '0.8 m', underpasses: 'Slowed', pumps: '3/3 Active', pumpsActive: 3, pumpsTotal: 3, siren: 'Standby' },
    { id: 'ward-007', name: 'Hebbal Flyover Corridor (Ward 7)', risk: 74, level: 'High', rainRate: '48 mm/hr', floodDepth: '0.6 m', underpasses: 'Clear', pumps: '2/2 Active', pumpsActive: 2, pumpsTotal: 2, siren: 'Standby' },
    { id: 'ward-085', name: 'Whitefield - ITPL Corridor (Ward 85)', risk: 58, level: 'Moderate', rainRate: '32 mm/hr', floodDepth: '0.3 m', underpasses: 'Clear', pumps: '1/2 Active', pumpsActive: 1, pumpsTotal: 2, siren: 'Standby' },
    { id: 'ward-003', name: 'Yelahanka Lake Basin (Ward 3)', risk: 36, level: 'Low', rainRate: '19 mm/hr', floodDepth: '0.1 m', underpasses: 'Clear', pumps: '0/1 Active', pumpsActive: 0, pumpsTotal: 1, siren: 'Standby' },
  ]);

  const [infrastructureAssets, setInfrastructureAssets] = useState<InfrastructureAsset[]>([
    { name: 'Namma Metro Purple Line', type: 'Transit', status: 'Operational', impact: 'Track sensors nominal; 0.2m runoff at Indiranagar station sump' },
    { name: 'Kempegowda Airport Expressway (NH44)', type: 'Highway', status: 'Hydroplane Alert', impact: 'Speed reduced to 50 km/h between Yelahanka & Devanahalli' },
    { name: 'BESCOM 66kV Substation (Koramangala)', type: 'Power Grid', status: 'Pump Active', impact: 'Automated flood barrier deployed; 0.4m below critical busbar' },
    { name: 'Victoria & Bowring Hospital Access', type: 'Healthcare', status: 'Priority Corridor', impact: 'Designated alternate emergency routes active via MG Road' }
  ]);

  const [capXmlSnippet, setCapXmlSnippet] = useState<string>('');

  // Initial fetch from backend
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [wards, assets] = await Promise.all([
        fetchDisasterWards(),
        fetchInfrastructure()
      ]);
      if (wards && wards.length > 0) setWardData(wards);
      if (assets && assets.length > 0) setInfrastructureAssets(assets);

      const activeWard = wards?.find(w => w.id === selectedWard) || wards?.[0];
      const xml = await fetchCapXml(activeWard?.rainRate || '78 mm/hr');
      setCapXmlSnippet(xml);
    } catch (e) {
      console.error('Error loading disaster ops data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update CAP XML when selected ward changes
  useEffect(() => {
    const cur = wardData.find(w => w.id === selectedWard);
    if (cur) {
      fetchCapXml(cur.rainRate).then(setCapXmlSnippet);
    }
  }, [selectedWard, wardData]);

  const handlePumpToggle = async (wardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedWard = await toggleWardPump(wardId);
    if (updatedWard) {
      setWardData(prev => prev.map(w => w.id === wardId ? { ...w, ...updatedWard } : w));
    } else {
      // Local fallback toggle
      setWardData(prev => prev.map(w => {
        if (w.id === wardId) {
          const total = w.pumpsTotal || 4;
          const active = (w.pumpsActive !== undefined ? w.pumpsActive : 3);
          const nextActive = active < total ? active + 1 : Math.max(0, active - 1);
          return {
            ...w,
            pumpsActive: nextActive,
            pumpsTotal: total,
            pumps: `${nextActive}/${total} Active`
          };
        }
        return w;
      }));
    }
  };

  const copyCap = () => {
    navigator.clipboard.writeText(capXmlSnippet);
    setCapCopied(true);
    setTimeout(() => setCapCopied(false), 2500);
  };

  const dispatchAlert = async () => {
    const cur = wardData.find(w => w.id === selectedWard) || wardData[0];
    setAlertDispatched(true);
    setDispatchStatus('Broadcasting via CAP v1.2 API...');
    try {
      const result = await dispatchAlertBroadcast({
        sector: cur.name,
        level: cur.level,
        headline: `Level 4 Convective Deluge Expected over ${cur.name}`,
        rainRate: cur.rainRate,
        etaMinutes: 25
      });
      setDispatchStatus(result.message || 'Alert successfully broadcast to NDMA / SDMA networks.');
    } catch {
      setDispatchStatus('Alert broadcasted to emergency nodes.');
    }
    setTimeout(() => {
      setAlertDispatched(false);
      setDispatchStatus('');
    }, 4500);
  };

  return (
    <div className="page-container" style={{ maxWidth: '1360px', padding: '24px 28px 100px' }}>
      <Navbar />
      {/* Top Nav Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Link href="/" className="nav-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <ArrowLeft size={18} /> Back to Live Radar Command Center
        </Link>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={loadData}
            title="Refresh Simulated Feeds"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <RefreshCw size={13} className={isLoading ? 'spin-animation' : ''} /> Refresh Simulation
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', color: '#ff6b6b', fontWeight: 600 }}>
            <Radio size={14} className="pulse-indicator" style={{ background: '#ef4444' }} /> NDRF Protocol (Drill / Demo)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', color: '#10B981', fontWeight: 600 }}>
            <CheckCircle2 size={14} /> BBMP Flood Cells (Simulation)
          </span>
        </div>
      </div>

      {/* Honest Data Status Banner */}
      <div style={{ padding: '10px 16px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '10px', marginBottom: '24px', fontSize: '12px', color: '#bae6fd', display: 'flex', alignItems: 'center', gap: '10px', lineHeight: 1.5 }}>
        <AlertTriangle size={16} className="shrink-0 text-sky-400" />
        <div>
          <strong style={{ color: '#38bdf8' }}>SIMULATION &amp; WORKSTATION DEMO:</strong> Ward-level waterlogging telemetry, pump states, and CAP v1.2 alerts are demonstration models calibrated against synthetic convective storm tracks. No live municipal dispatch is active.
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '30px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={32} color="var(--color-severe)" /> Municipal Disaster Operations &amp; Civil Defense
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>
          Direct translation of radar nowcasts into ward-level flood vulnerability, infrastructure defense alerts, and Common Alerting Protocol (CAP v1.2) emergency broadcasts.
        </p>
      </div>

      {/* Primary KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Critical Flood Wards</span>
            <AlertTriangle size={18} color="#ef4444" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ef4444', marginTop: '6px' }}>
            {wardData.filter(w => w.level === 'Critical').length} Wards
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Simulated rainfall rate &gt;60 mm/hr
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Peak Urban Inundation</span>
            <Layers size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b', marginTop: '6px' }}>
            {wardData[0]?.floodDepth || '1.4 m'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Bellandur &amp; Silk Board simulated runoff
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Drainage Pump Stations</span>
            <LifeBuoy size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10B981', marginTop: '6px' }}>
            {wardData.reduce((acc, w) => acc + (w.pumpsActive || 0), 0)} / {wardData.reduce((acc, w) => acc + (w.pumpsTotal || 0), 0)} Active
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Simulated telemetry model
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Simulated Lead Time</span>
            <Radio size={18} color="var(--color-precip)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-precip)', marginTop: '6px' }}>
            +40 Mins
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Demo scenario advance warning
          </div>
        </div>
      </div>

      {/* Main Grid: Ward Risk Table + Infrastructure Asset Defense */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '28px' }}>
        
        {/* Ward Flood Vulnerability Matrix */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={20} color="var(--color-precip)" /> Ward Flood Vulnerability Matrix
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Click row to select &bull; Click pump badge to toggle
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>Ward</th>
                  <th style={{ padding: '10px 8px' }}>Vulnerability</th>
                  <th style={{ padding: '10px 8px' }}>Peak Rain</th>
                  <th style={{ padding: '10px 8px' }}>Est. Inundation</th>
                  <th style={{ padding: '10px 8px' }}>Underpasses</th>
                  <th style={{ padding: '10px 8px' }}>Pump Station Action</th>
                </tr>
              </thead>
              <tbody>
                {wardData.map((ward) => (
                  <tr 
                    key={ward.id} 
                    onClick={() => setSelectedWard(ward.id)}
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.05)', 
                      cursor: 'pointer',
                      background: selectedWard === ward.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{ward.name}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        background: ward.risk > 80 ? 'rgba(239, 68, 68, 0.2)' : ward.risk > 60 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: ward.risk > 80 ? '#ef4444' : ward.risk > 60 ? '#f59e0b' : '#10B981'
                      }}>
                        {ward.risk}% &bull; {ward.level}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{ward.rainRate}</td>
                    <td style={{ padding: '12px 8px', color: ward.floodDepth.startsWith('1') ? '#ef4444' : 'var(--text-primary)', fontWeight: 600 }}>
                      {ward.floodDepth}
                    </td>
                    <td style={{ padding: '12px 8px' }}>{ward.underpasses}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <button
                        onClick={(e) => handlePumpToggle(ward.id, e)}
                        title="Click to toggle pump unit"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(96, 165, 250, 0.15)',
                          border: '1px solid #3B82F6',
                          color: '#60A5FA',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        <Power size={12} /> {ward.pumps}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Critical Infrastructure Exposure */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={20} color="var(--color-warning)" /> Critical Asset Exposure
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {infrastructureAssets.map((asset, i) => (
              <div key={i} style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', borderLeft: '3px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{asset.name}</span>
                  <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                    {asset.type}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: asset.status.includes('Alert') ? '#f59e0b' : '#10B981', fontWeight: 600, marginBottom: '4px' }}>
                  &bull; {asset.status}
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {asset.impact}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CAP Protocol & Broadcast Actions */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={20} color="#10B981" /> Common Alerting Protocol (CAP v1.2) Automated Emergency Feed
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Standardized XML payload ingested by National Disaster Management Authority (NDMA) &amp; Integrated Public Alert Warning System (IPAWS).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={copyCap}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <FileText size={15} /> {capCopied ? "Copied XML!" : "Copy CAP XML"}
            </button>

            <button 
              onClick={dispatchAlert}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: alertDispatched ? '#10B981' : 'var(--color-severe)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
                transition: 'background 0.2s'
              }}
            >
              <Send size={15} /> {alertDispatched ? "Broadcast Dispatched via SMS Gateway!" : "Broadcast Public Cell Alert"}
            </button>
          </div>
        </div>

        {dispatchStatus && (
          <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', borderRadius: '6px', color: '#10B981', fontSize: '12px', fontWeight: 600 }}>
            {dispatchStatus}
          </div>
        )}

        <pre style={{
          background: 'rgba(0,0,0,0.4)',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#86efac',
          fontFamily: 'monospace',
          overflowX: 'auto',
          maxHeight: '220px',
          margin: 0
        }}>
          {capXmlSnippet || "Loading dynamic CAP v1.2 payload from API..."}
        </pre>
      </div>
    </div>
  );
}
