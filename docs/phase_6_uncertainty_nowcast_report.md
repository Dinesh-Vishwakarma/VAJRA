# VAJRA PHASE 6: UNCERTAINTY & NOWCAST CONFIDENCE REPORT

**Date:** October 4, 2026  
**Document Version:** 1.0.0  
**Phase:** 6 — Kinematic Uncertainty & Explainable Confidence Classification  
**Status:** Completed & Validated  
**Prerequisites:** Phase 5 Storm Cell Detection & Tracking (Active)  
**Classification:** `SYNTHETIC CELL TRACKING — DEMO ONLY`

---

## 1. Overview & Architectural Principles

Phase 6 introduces a deterministic, explainable kinematic nowcast uncertainty model and a categorical confidence classifier for tracked convective storm cells in VAJRA.

### Core Constraints Maintained:
- **No Machine Learning or Neural Networks:** All uncertainty and confidence metrics are derived from classical kinematic motion vectors and tracking history.
- **No Fabricated Probabilities:** The system outputs explainable categories (`HIGH`, `MEDIUM`, `LOW`) and physical distance bounds ($\text{km}$), not synthetic percentages (e.g. no "94% chance of rain" or fake AI confidence scores).
- **Zero Redesign:** Built directly on top of the Phase 5 tracking pipeline (`src/services/storm_tracking.py`) and existing Mapbox GL JS architecture (`VajraMap.tsx`, `MapLegend.tsx`, `MapControls.tsx`).
- **Complete Timeline Synchronization:** All uncertainty rings and nowcast projections advance synchronously with `timeIdx` playback and scrubbing.

---

## 2. Mathematical Formulations

### 2.1 Motion Stability Index ($\mu_{\text{stab}}$)
For each active track, motion stability measures the normalized consistency of recent velocity vectors $\mathbf{v} = (u, v)$ over up to the last 4 observations:

1. **Translational Speed Variation:**
   $$\sigma_s = \sqrt{\frac{1}{m} \sum_{k=1}^m (s_k - \bar{s})^2}$$
   $$V_{\text{speed}} = \min\left(1.0, \frac{\sigma_s}{\max(5.0, \bar{s})}\right)$$

2. **Directional Bearing Variation:**
   $$\Delta \theta_{\max} = \max_{k} |\text{bearing}_{k} - \text{bearing}_{k-1}| \quad (\text{wrapped to } [0^\circ, 180^\circ])$$
   $$V_{\text{angle}} = \min\left(1.0, \frac{\Delta \theta_{\max}}{60^\circ}\right)$$

3. **Composite Stability:**
   $$\mu_{\text{stab}} = \max\left(0.0, \min\left(1.0, 1.0 - (0.5 \cdot V_{\text{speed}} + 0.5 \cdot V_{\text{angle}})\right)\right)$$

*For tracks with $<2$ historical observations, $\mu_{\text{stab}}$ defaults to $0.60$ (1 observation) or $0.35$ (incipient).*

---

### 2.2 Deterministic Nowcast Uncertainty Formula ($R_{\text{unc}}$)

Uncertainty is evaluated as a physical radius ($\text{km}$) around the projected linear centroid:

$$R_{\text{unc}}(h) = R_{\text{base}} + f_{\text{horizon}}(h) + f_{\text{instability}}(\mu_{\text{stab}}, h) + f_{\text{history}}(N, h)$$

Where:
* **$h \in \{15, 30\}$ minutes:** Forecast projection horizon.
* **$R_{\text{base}} = 1.5\text{ km}$:** Base sensor & centroid spatial quantization uncertainty ($\approx 1$ radar grid cell).
* **$f_{\text{horizon}}(h) = 0.08 \times h$:** Linear kinematic drift expansion ($1.2\text{ km}$ at $+15\text{m}$, $2.4\text{ km}$ at $+30\text{m}$).
* **$f_{\text{instability}}(\mu_{\text{stab}}, h) = 2.5 \times (1.0 - \mu_{\text{stab}}) \times w_h$:** Penalizes erratic velocity vectors ($w_{15} = 1.0$, $w_{30} = 1.5$).
* **$f_{\text{history}}(N, h) = 0.8 \times \max(0, 3 - N) \times w_h$:** Penalizes tracks with fewer than 3 observed frames ($N = \text{len(history)}$).

> **Crucial Operational Notice:**  
> The uncertainty radius $R_{\text{unc}}$ represents kinematic divergence bounds and centroid positional tolerance. It is **not** a statistical Gaussian probability ellipse or plume dispersion model.

---

### 2.3 Categorical Confidence Rules

| Confidence Class | Required History ($N$) | Required Stability ($\mu_{\text{stab}}$) | Speed Condition | Continuity Condition |
| :--- | :--- | :--- | :--- | :--- |
| **`HIGH`** | $N \ge 3$ frames | $\mu_{\text{stab}} \ge 0.70$ | $s \ge 5.0\text{ km/h}$ | `lost_count == 0` |
| **`MEDIUM`** | $N \ge 2$ frames | $\mu_{\text{stab}} \ge 0.45$ | Any | `lost_count <= 1` |
| **`LOW`** | $N < 2$ frames | $\mu_{\text{stab}} < 0.45$ | Any | Any |

---

## 3. Mapbox Layer Architecture & Visual Hierarchy

All uncertainty and tracking layers are attached to `storm-cells-source` and layered in strict operational sequence:

```
Basemap (Mapbox Standard / 3D DEM Terrain)
  ↓
Radar Raster Layer (radar-layer, slot: middle)
  ↓
1. storm-cells-hull (fill, opacity: 0.22, intensity-colored)
  ↓
2. storm-cells-contour (line, width: 1.6px, opacity: 0.90)
  ↓
3. storm-cells-unc-30m-fill (fill, #94a3b8, opacity: 0.05) [Phase 6]
4. storm-cells-unc-30m-line (line, #94a3b8, width: 1.1px, dashed: [2, 3]) [Phase 6]
  ↓
5. storm-cells-unc-15m-fill (fill, #38bdf8, opacity: 0.09) [Phase 6]
6. storm-cells-unc-15m-line (line, #38bdf8, width: 1.4px, dashed: [3, 2]) [Phase 6]
  ↓
7. storm-cells-vector (line, #38bdf8, width: 2.2px, dashed: [2, 2], projected track)
  ↓
8. storm-cells-centroid (circle, radius: 6px, white border, intensity-colored core)
  ↓
9. storm-cells-labels (symbol, text-field: ID, peak dBZ, speed km/h)
  ↓
UI Controls (MapControls, MapLegend, Timeline scrubber)
```

### Visual Differentiation Strategy:
- **Observed Storm Cells:** Solid boundaries, high contrast, saturated fills.
- **+15 min Forecast:** Lighter cyan dashed perimeter (`#38bdf8`, dash `[3, 2]`), soft fill.
- **+30 min Forecast:** Fainter slate dashed perimeter (`#94a3b8`, dash `[2, 3]`), subtler fill.
- The uncertainty rings are visually distinct and can never be confused with radar echoes or actual cell footprints.

---

## 4. Extended Interactive Popover Specification

Clicking any storm cell hull or centroid displays the extended popover containing:
- Cell Identifier & Intensity Class (`CELL-01 | EXTREME`)
- Categorical Confidence Badge (`HIGH CONFIDENCE` / `MEDIUM CONFIDENCE` / `LOW CONFIDENCE`)
- Peak & Mean Reflectivity (dBZ)
- Footprint Area ($\text{km}^2$)
- Current Motion Vector: Speed ($\text{km/h}$), Heading ($^\circ$), and $(u, v)$ velocity components
- Kinematic Nowcast Details:
  - `+15 min`: Uncertainty $\pm X.X\text{ km}$
  - `+30 min`: Uncertainty $\pm Y.Y\text{ km}$
- Mandatory Advisory Text:
  - *"Kinematic nowcast — uncertainty increases with forecast horizon."*
  - Badge: `"SYNTHETIC CELL TRACKING — DEMO ONLY"`

---

## 5. Map Legend Extension

The existing Mapbox HUD legend (`MapLegend.tsx`) preserves the radar dBZ color ramp untouched and appends an operational **STORM CELL NOWCAST** key:
- **Observed Cell:** Solid cyan rounded box
- **Projected Path:** Dashed cyan vector line
- **15-min Uncertainty:** Dashed cyan ring
- **30-min Uncertainty:** Dashed slate ring

---

## 6. Known Limitations

1. **Kinematic Extrapolation:** Trajectories assume persistence of recent velocity; non-linear storm acceleration, orographic blocking, and convective downdraft collapse are not physically simulated.
2. **Deterministic Geometry:** Uncertainty circles represent bounding rings based on kinematic variance and horizon, not probabilistic confidence intervals.
3. **Procedural Dataset:** The underlying radar field is synthetic; confidence levels reflect synthetic tracking stability and do not indicate real atmospheric predictability.
