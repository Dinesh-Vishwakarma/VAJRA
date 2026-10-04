"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ArrowLeft, 
  Radio, 
  ShieldAlert, 
  RotateCcw, 
  Thermometer, 
  Plane, 
  BarChart2, 
  Cpu, 
  AlertTriangle, 
  Settings, 
  Globe 
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Live Radar', icon: Globe, color: 'var(--color-precip)' },
    { href: '/disaster-ops', label: 'Disaster Ops', icon: ShieldAlert, color: '#ef4444' },
    { href: '/replay', label: 'Case Studies', icon: RotateCcw, color: 'var(--color-precip)' },
    { href: '/thermodynamics', label: 'Soundings', icon: Thermometer, color: '#f59e0b' },
    { href: '/aviation', label: 'Aviation', icon: Plane, color: '#60A5FA' },
    { href: '/analytics', label: 'Analytics', icon: BarChart2, color: '#10B981' },
    { href: '/models', label: 'Models', icon: Cpu, color: '#A78BFA' },
  ];

  return (
    <header className="glass-panel" style={{
      marginBottom: '28px',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
      borderRadius: '14px',
      position: 'sticky',
      top: '16px',
      zIndex: 100,
      backdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
    }}>
      {/* Brand & Live status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 800,
            margin: 0,
            letterSpacing: '1px',
            background: 'linear-gradient(90deg, #81B3F7, #90CDF4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            VAJRA
          </h1>
          <span style={{
            fontSize: '10px',
            background: 'rgba(14, 165, 233, 0.15)',
            color: '#38bdf8',
            padding: '3px 8px',
            borderRadius: '12px',
            fontWeight: 'bold',
            border: '1px solid rgba(14, 165, 233, 0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
            WORKSTATION DEMO
          </span>
        </Link>
      </div>

      {/* Nav Links Tabs */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        maxWidth: '100%',
        padding: '2px 0'
      }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: isActive ? `1px solid ${item.color}` : '1px solid var(--border-color)',
                boxShadow: isActive ? `0 0 12px ${item.color}30` : 'none'
              }}
            >
              <Icon size={14} color={isActive ? item.color : 'var(--text-secondary)'} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Action Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link 
          href="/alerts" 
          title="Active Alerts"
          style={{
            color: 'var(--color-severe)',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            background: pathname === '/alerts' ? 'rgba(239,68,68,0.2)' : 'transparent'
          }}
        >
          <AlertTriangle size={18} />
        </Link>
        <Link 
          href="/settings" 
          title="Settings"
          style={{
            color: 'var(--text-secondary)',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            background: pathname === '/settings' ? 'rgba(255,255,255,0.1)' : 'transparent'
          }}
        >
          <Settings size={18} />
        </Link>
      </div>
    </header>
  );
}
