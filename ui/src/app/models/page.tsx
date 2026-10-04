"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Cpu, Layers, GitMerge, Zap, Brain, Sparkles, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchModelsInfo } from '@/lib/api';

export default function ModelsPage() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [runtime, setRuntime] = useState<any>({
    onnxRuntimeVersion: "1.18.0",
    executionProvider: "CPUExecutionProvider",
    precision: "FP16 Optimized",
    modelLoaded: true,
    inferenceLatencyMs: 142.5
  });

  const [shapFeatures, setShapFeatures] = useState<any[]>([
    { feature: "Convective Available Potential Energy (CAPE)", importance: 38, category: "Thermodynamics", color: "#E53E3E" },
    { feature: "Radar Reflectivity Surge (dBZ/10min)", importance: 26, category: "Doppler Radar", color: "#3182CE" },
    { feature: "Cloud-Top Glaciation (TIR Brightness Temp)", importance: 18, category: "INSAT-3DS Satellite", color: "#805AD5" },
    { feature: "Bulk Wind Shear (0-6 km)", importance: 11, category: "Kinematics", color: "#F59E0B" },
    { feature: "Surface Equivalent Potential Temp (Theta-E)", importance: 7, category: "Boundary Layer", color: "#10B981" },
  ]);

  const [architectureLayers, setArchitectureLayers] = useState<any[]>([
    { name: "Radar Stream", encoder: "3D U-Net Encoder (Z, V, W polar reprojected)" },
    { name: "Satellite Stream", encoder: "ResNet-34 Encoder (INSAT-3DS TIR1, TIR2, WV)" },
    { name: "Atmospheric Physics", encoder: "Multi-Layer CNN (Gridded ERA5 thermodynamics)" },
    { name: "Fusion Head", type: "Multi-Head Cross-Attention (Dynamic atmospheric weighting)" },
    { name: "Nowcasting Backbone", type: "PredRNN / ConvLSTM Cell (0–120m sequential states)" },
    { name: "Physics Residual", type: "Farneback Optical Flow Advection + Convective Residual Head" }
  ]);

  const loadModelsData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchModelsInfo();
      if (data) {
        if (data.runtime) setRuntime(data.runtime);
        if (data.shapFeatures) setShapFeatures(data.shapFeatures);
        if (data.architectureLayers) setArchitectureLayers(data.architectureLayers);
      }
    } catch (err) {
      console.error('Error fetching model info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadModelsData();
  }, []);

  return (
    <div className="page-container" style={{ maxWidth: '1200px', padding: '24px 24px 100px' }}>
      <Navbar />
      <Link href="/" className="nav-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px', textDecoration: 'none' }}>
        <ArrowLeft size={18} /> Back to Command Center
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '28px' }}>Model Architecture &amp; Explainable AI (XAI)</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Deep learning multimodal fusion pipeline with thermodynamic constraints and SHAP attribution.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={loadModelsData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <RefreshCw size={13} className={isLoading ? 'spin-animation' : ''} /> Refresh Specs
          </button>
          <span style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd', border: '1px solid rgba(167, 139, 250, 0.35)', borderRadius: '6px', fontWeight: 'bold' }}>
            Concept Specification • Research Prototype
          </span>
        </div>
      </div>

      {/* Honest Data Status Banner */}
      <div style={{ padding: '10px 16px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '10px', marginTop: '20px', fontSize: '12px', color: '#bae6fd', display: 'flex', alignItems: 'center', gap: '10px', lineHeight: 1.5 }}>
        <AlertTriangle size={16} className="shrink-0 text-sky-400" />
        <div>
          <strong style={{ color: '#38bdf8' }}>RESEARCH ARCHITECTURE SPECIFICATION (TARGET CONCEPT):</strong> Multimodal deep networks (3D U-Net, ResNet-34, Cross-Attention) represent VAJRA's planned deep-learning roadmap. Active production runtime currently employs deterministic kinematic extrapolation and baseline tabular models.
        </div>
      </div>

      {/* Model Fusion Architecture Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Layers size={22} color="var(--color-precip)" />
            <h3 style={{ margin: 0, fontSize: '18px' }}>1. Multimodal Encoders</h3>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Three independent spatial encoder heads extract multi-scale representations:
          </p>
          <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li><strong style={{ color: 'var(--text-primary)' }}>Radar Stream:</strong> 3D U-Net encoder processing Doppler sweeps (Z, V, W).</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Satellite Stream:</strong> ResNet-34 encoder for INSAT-3DS TIR1, TIR2, and WV.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Thermodynamics:</strong> Multi-layer CNN processing gridded ERA5 physics tensors.</li>
          </ul>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <GitMerge size={22} color="var(--color-warning)" />
            <h3 style={{ margin: 0, fontSize: '18px' }}>2. Cross-Attention Fusion</h3>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Multi-head cross-attention dynamically weights modalities based on atmospheric conditions:
          </p>
          <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li><strong style={{ color: 'var(--text-primary)' }}>Clear Sky Convection:</strong> Satellite TIR &amp; CAPE receive 75% attention weight prior to radar echoes.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Developed Storms:</strong> Doppler radar velocity divergence receives 80% weight for kinematics.</li>
          </ul>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Zap size={22} color="var(--color-good)" />
            <h3 style={{ margin: 0, fontSize: '18px' }}>3. Physics-Constrained Head</h3>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Dual-branch decoder enforces mass conservation and thermodynamic reality:
          </p>
          <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li><strong style={{ color: 'var(--text-primary)' }}>Kinematic Branch:</strong> Optical flow predicts deterministic advection vectors.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Residual Branch:</strong> Deep network models non-linear convective genesis and decay.</li>
          </ul>
        </div>
      </div>

      {/* SHAP Feature Importance Attribution */}
      <div className="glass-panel" style={{ padding: '28px', marginTop: '24px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={20} color="var(--color-precip)" /> SHAP Feature Attribution (Convective Cell Initiation)
        </h3>
        <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Game-theoretic Shapley values revealing which meteorological variables drove the severe nowcast decision.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {shapFeatures.map((item: any, index: number) => (
            <div key={index}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.feature}</span>
                <span style={{ fontSize: '12px', color: item.color, fontWeight: 'bold' }}>
                  {item.importance}% importance &bull; {item.category}
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${item.importance * 2}%`, 
                    height: '100%', 
                    background: item.color, 
                    borderRadius: '4px',
                    transition: 'width 0.8s ease'
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
