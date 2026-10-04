"use client";
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ArrowLeft, AlertTriangle, CloudLightning, Droplets } from 'lucide-react';

export default function Alerts() {
  return (
    <div className="page-container" style={{ maxWidth: '1000px', padding: '24px 24px 100px' }}>
      <Navbar />
      <Link href="/" className="nav-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
        <ArrowLeft size={20} /> Back to Dashboard
      </Link>
      
      <h1>Active Alerts</h1>
      <p style={{ color: 'var(--text-secondary)' }}>Simulated Convective Warnings for Bengaluru Urban / South Grid (Exercise Scenario)</p>
      
      {/* Honest Data Status Banner */}
      <div style={{ padding: '10px 16px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '10px', marginTop: '16px', marginBottom: '24px', fontSize: '12px', color: '#bae6fd', display: 'flex', alignItems: 'center', gap: '10px', lineHeight: 1.5 }}>
        <AlertTriangle size={16} className="shrink-0 text-sky-400" />
        <div>
          <strong style={{ color: '#38bdf8' }}>SIMULATED ALERT WORKSTATION:</strong> Severe convective alert cards represent demonstration scenarios triggered by synthetic radar forecast grids. Not for operational public warning.
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
        <div className="alert-card severe glass-panel" style={{ padding: '24px' }}>
          <div className="alert-header">
            <CloudLightning size={24} color="var(--color-severe)" />
            <h3 style={{ fontSize: '20px', color: 'var(--color-severe)' }}>Tornadic Vortex Signature</h3>
          </div>
          <p style={{ fontSize: '16px' }}>Level 3 Severe &bull; 94% Confidence</p>
          <p style={{ marginTop: '8px' }}>DeepNowcast model detects severe convective cell #89 approaching from WNW. Peak gusts estimated at 102 km/h.</p>
          <div className="eta" style={{ fontSize: '18px' }}>ETA: 18 mins (Impact expected at 15:52 IST)</div>
        </div>

        <div className="alert-card warning glass-panel" style={{ padding: '24px' }}>
          <div className="alert-header">
            <Droplets size={24} color="var(--color-warning)" />
            <h3 style={{ fontSize: '20px', color: 'var(--color-warning)' }}>Precipitation Surge</h3>
          </div>
          <p style={{ fontSize: '16px' }}>Level 2 Warning &bull; 87% Confidence</p>
          <p style={{ marginTop: '8px' }}>Flash flood conditions likely in low-lying areas of Sector 4. Estimated rainfall rate: +42mm/hr.</p>
          <div className="eta" style={{ fontSize: '18px', color: 'var(--color-warning)' }}>ETA: 45 mins</div>
        </div>
      </div>
    </div>
  );
}
