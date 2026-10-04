# VAJRA PHASE 5 — PRE-IMPLEMENTATION STORM CELL CAPABILITY AUDIT REPORT

**Date:** October 4, 2026  
**Document Version:** 1.0.0  
**Status:** Audit Completed — Non-destructive inspection  
**Subject:** Capability Assessment for Radar Storm Cell Segmentation, Centroid Tracking, and Mapbox Integration

---

## 1. Executive Summary

This audit assesses the feasibility of implementing **Phase 5: Storm Cell Detection & Tracking** on top of VAJRA's existing meteorological architecture.

The existing system provides:
- 18 frames of synthetic radar reflectivity data at 5-minute intervals ($T+0$ to $T+85$ minutes).
- Active FastAPI backend rendering georeferenced raster tiles via `/api/radar/frame/{time_idx}`.
- Active Mapbox GL JS 3D client rendering an `ImageSource` (`radar-source`) with calibrated meteorological color ramps (Phase 3) and a temporal playback controller (Phase 4).

### Key Audit Finding
The underlying scalar radar data (`latest_forecast.npy`) is **fully capable of supporting robust, deterministic 2D storm cell segmentation, centroid kinematics, polygon contouring, and vector tracking**. Because the radar field is generated procedurally with high spatial-temporal coherence, classical morphological segmentation (connected components) and kinematic association (nearest-centroid / Hungarian matching) will yield **clean, reliable results with negligible computational overhead (<1 ms per frame)**. Machine learning is **neither present nor required** for this tracking pipeline.

---

## 2. Quantitative Data & Pipeline Audit

### 2.1 Source Data
- **File Location:** `data/processed/latest_forecast.npy`
- **Synthesis Engine:** `init_sample_forecast_if_missing()` located in `src/api/main.py`.
- **Tensor Properties:**
  - **Dimensions:** `(18, 40, 40)` — 18 temporal frames, 40 rows (Y-axis, North-South), 40 columns (X-axis, West-East).
  - **Data Type:** `float32`
  - **Value Range:** `0.0` to `65.0` dBZ.
  - **Units:** Equivalent radar reflectivity factor ($Z_e$ in dBZ).
- **Physical Modeling:**
  - Procedural/synthetic simulation of two interacting convective Gaussian cores moving diagonally from NW to SE.
  - Primary core: Initial intensity $30.0\text{ dBZ}$, growing by $+2.2\text{ dBZ/frame}$ up to a maximum cap of $65.0\text{ dBZ}$ at $t=16$.
  - Secondary core: Positioned at $(\Delta y = +6, \Delta x = -5)$ relative to primary, with $75\%$ intensity and steeper spatial decay ($2.0 \cdot r^2$).
- **Direct Scalar Access:**
  - The raw scalar data is **directly accessible in Python** via standard memory loading (`np.load('data/processed/latest_forecast.npy')`).
  - Accessing the scalar array directly bypasses the 512×512 PNG colormapping pipeline, eliminating color-quantization loss and interpolation artifacts.

---

### 2.2 Spatial Geometry & Georeferencing
- **Grid Dimensions:** $40 \times 40$ regular Cartesian grid.
- **Geographic Bounding Box** (from `ui/src/lib/mapbox.ts`):
  - **Northwest (NW):** `[77.3446° E, 13.1916° N]`
  - **Northeast (NE):** `[77.8446° E, 13.1916° N]`
  - **Southeast (SE):** `[77.8446° E, 12.7516° N]`
  - **Southwest (SW):** `[77.3446° E, 12.7516° N]`
- **Spatial Extent & Pixel Resolution:**
  - Longitude Span: $77.8446 - 77.3446 = 0.5000^\circ \approx 54.34\text{ km}$.
  - Latitude Span: $13.1916 - 12.7516 = 0.4400^\circ \approx 48.68\text{ km}$.
  - Grid Cell Resolution ($\Delta x$): $54.34\text{ km} / 40 \approx 1.36\text{ km}$ per pixel.
  - Grid Cell Resolution ($\Delta y$): $48.68\text{ km} / 40 \approx 1.22\text{ km}$ per pixel.
  - Grid Cell Footprint: $\approx 1.66\text{ km}^2$ per grid element.
- **Coordinate Mapping Transformation:**
  - Given grid pixel index $(y, x)$ where $y \in [0, 39]$ (row, from North to South) and $x \in [0, 39]$ (column, from West to East):
    $$\text{Latitude}(y) = 13.1916 - \left(\frac{y + 0.5}{40.0}\right) \times 0.4400$$
    $$\text{Longitude}(x) = 77.3446 + \left(\frac{x + 0.5}{40.0}\right) \times 0.5000$$
  - The existing Bengaluru radar bounds are fully consistent and can be reused directly for all vector and cell coordinates.

---

### 2.3 Temporal Dynamics & Inter-Frame Coherence
- **Frame Spacing:** $\Delta t = 5\text{ minutes}$ (total temporal span: 85 minutes, $T+0$ to $T+85$).
- **Displacement Vector:**
  - $y_{\text{center}}(t) = 12 + \lfloor 0.8 \cdot t \rfloor$ (Southward drift: $\approx 0.8\text{ cells/frame} \approx 0.97\text{ km/5 min}$)
  - $x_{\text{center}}(t) = 10 + \lfloor 1.2 \cdot t \rfloor$ (Eastward drift: $\approx 1.2\text{ cells/frame} \approx 1.63\text{ km/5 min}$)
  - Total frame displacement: $\sqrt{1.2^2 + 0.8^2} \approx 1.44\text{ cells} \approx 1.90\text{ km per 5 min}$.
  - Calculated Storm Speed: $\approx 22.8\text{ km/h}$.
  - Storm Heading / Bearing: $\arctan2(\Delta x, -\Delta y) \approx \arctan2(1.63, 0.97) \approx 124^\circ$ (East-Southeast).
- **Empirical Inter-Frame Comparison:**
  - **Frame 0 $\to$ 1:** Cell expands from 21 cells to 25 cells ($\ge 20\text{ dBZ}$). Primary core centroid moves from $(y=12.0, x=10.0)$ to $(y=12.0, x=11.0)$.
  - **Frame 5 $\to$ 6:** Secondary convective core emerges clearly at $(y=22.0, x=11.0) \to (y=22.0, x=12.0)$. Primary core moves $(16.0, 16.0) \to (16.0, 17.0)$.
  - **Frame 10 $\to$ 11:** Both cores are mature ($\ge 40\text{ dBZ}$). Core A moves $(20.0, 22.0) \to (20.0, 23.0)$; Core B moves $(26.0, 17.0) \to (26.0, 18.0)$.
  - **Frame 16 $\to$ 17:** Maximum mature stage ($65.0\text{ dBZ}$). Displacements remain stable at $\approx 1\text{ grid unit}$.
- **Coherence Verdict:** Spatial overlap between consecutive frames is extremely high ($\text{IoU} > 0.65$). No teleportation, discontinuous deformation, or erratic disappearance occurs.

---

### 2.4 Segmentation Feasibility
Morphological connected-component analysis with 8-connectivity yielded the following quantitative breakdown:

| Threshold | Frame 0 (T+0) | Frame 5 (T+25) | Frame 10 (T+50) | Frame 16 (T+80) | Characteristic Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **$\ge 20$ dBZ** | 2 cells (21, 5 px) | 2 cells (45, 21 px) | 1 merged envelope (98 px) | 1 merged envelope (140 px) | Captures broad stratiform precipitation envelope; merges multi-cell clusters. |
| **$\ge 30$ dBZ** | 1 cell (1 px) | 2 cells (21, 1 px) | 2 cells (45, 13 px) | 1 merged complex (109 px) | Detects moderate convective activity. Separates cores until late-stage maturity. |
| **$\ge 40$ dBZ** | 0 cells (max 30.0) | 1 cell (1 px) | 1 core (25 px) | 2 discrete cores (57, 13 px) | Isolates intense convective storm cores with high fidelity throughout maturity. |

- **Recommended Segmentation Approach:**
  - **Dual-threshold / Hierarchical approach (TITAN-inspired):**
    1. **Storm Envelope Threshold:** $\ge 30\text{ dBZ}$ with a minimum area filter ($\ge 4\text{ cells} \approx 6.6\text{ km}^2$) to define cell footprint geometry and boundary polygons.
    2. **Convective Core Threshold:** $\ge 40\text{ dBZ}$ (or local intensity peak detection) to identify distinct sub-cell cores inside merged complexes.

---

### 2.5 Tracking Feasibility
- **Kinematic Conditions:**
  - Cell diameter: $10\text{ to }25\text{ km}$ ($8\text{ to }20\text{ pixels}$).
  - Frame displacement: $1.9\text{ km}$ ($1.4\text{ pixels}$).
  - Ratio $\frac{\text{displacement}}{\text{cell diameter}} \approx 0.10 \ll 0.50$.
- **Algorithm Evaluation:**
  - **Intersection-over-Union (IoU):** Valid for $t \ge 3$, but fragile for nascent single-pixel cores ($t=0\to 1$) where a 1-pixel shift could drop IoU to 0.
  - **Nearest-Centroid with Gating Radius ($R_{\text{gate}} = 5\text{ km}$):** Ideal. Since the primary and secondary cores remain separated by $\approx 10\text{ km}$, a centroid search window of $5\text{ km}$ eliminates any false associations.
  - **Greedy / Hungarian Matching:** Both algorithms give identical 100% precision on this 2-cell topology.
- **Machine Learning Necessity:**
  - No tracking or nowcasting ML models exist in `models/` (the sole model `xgboost_level1.joblib` is a 4-feature risk-level tabular classifier).
  - No ML is needed. Classical centroid tracking is deterministic, mathematically exact, and computationally negligible.

---

## 3. Structural Responses (Sections A – H)

### A. What the Current Dataset Actually Supports
1. **2D Scalar Reflectivity:** Real-valued dBZ readings on a consistent $40 \times 40$ grid across 18 time steps.
2. **Deterministic Advection:** Smooth, coherent convective core motion towards the ESE ($124^\circ$) at $\approx 23\text{ km/h}$.
3. **Threshold-Based Cell Footprints:** Contours, bounding envelopes, and polygon boundaries derived from dBZ isolines.
4. **Core Intensity Tracking:** Continuous tracking of cell area, peak reflectivity ($\text{dBZ}_{\text{max}}$), and mean reflectivity ($\text{dBZ}_{\text{mean}}$).
5. **Projected Nowcast Tracks:** 15–30 minute linear trajectory extrapolation based on historical inter-frame motion.

### B. What Phase 5 Can Legitimately Implement
1. **Backend Storm Cell Detection Service (`src/services/storm_tracking.py`):**
   - Precomputes or lazily extracts storm cells for all 18 frames.
   - Connects components, computes geometric centroids, areas in $\text{km}^2$, and peak dBZ.
2. **Cell Association & Tracking Engine:**
   - Assigns persistent identifiers (`CELL-01`, `CELL-02`) across the 18 frames.
   - Calculates instantaneous and smoothed velocity vectors $(u, v)$, speed ($\text{km/h}$), and heading ($\theta$).
3. **REST API Endpoint (`/api/radar/cells` or `/api/radar/cells/{time_idx}`):**
   - Serves cell telemetry as standard GeoJSON `FeatureCollection` objects.
4. **Mapbox Vector Visualization:**
   - Dynamic GeoJSON overlay synced with playback `timeIdx`.
   - Cell centroid markers, velocity vector arrows, cell boundary polygons, and HUD labels.

### C. Recommended Detection Algorithm
- **Algorithm:** Multi-Threshold Connected Component Labeling with Area Filtering.
  1. **Primary Segmentation:** Apply threshold $T_{\text{env}} = 30.0\text{ dBZ}$.
  2. **Morphological Labeling:** 8-connectivity component labeling via `scipy.ndimage.label`.
  3. **Noise Rejection:** Filter components with $\text{area} < 3\text{ pixels}$ ($< 5\text{ km}^2$).
  4. **Core Refinement:** For components with area $> 30\text{ pixels}$, evaluate local sub-peaks at $T_{\text{core}} = 40.0\text{ dBZ}$ to split conjoined multi-cell clusters.
  5. **Polygon Generation:** Extract vectorized boundary contours (`geojson.Polygon`) mapped to WGS84 coordinates.

### D. Recommended Tracking Algorithm
- **Algorithm:** Gated Greedy Nearest-Centroid Matching.
  1. For frame $t$, predict expected centroid positions of existing active tracks using previous velocity:
     $$\hat{\mathbf{p}}_{i}(t) = \mathbf{p}_i(t-1) + \mathbf{v}_i(t-1) \cdot \Delta t$$
  2. Compute Euclidean distance matrix $D_{ij} = \|\mathbf{p}_j(t) - \hat{\mathbf{p}}_i(t)\|$ between candidate detections and active tracks.
  3. Apply association gate $R_{\text{gate}} = 5.0\text{ km}$ ($4\text{ grid units}$).
  4. Pair candidates greedily by minimum distance:
     - Matched candidates update track history and smooth velocity: $\mathbf{v}_i(t) = \alpha \mathbf{v}_{\text{meas}} + (1-\alpha) \mathbf{v}_i(t-1)$ ($\alpha = 0.7$).
     - Unmatched detections initiate new tracks with `first_seen_frame = t`.
     - Missing tracks increment a `lost_counter` and are retired if inactive for $>2$ frames.

### E. Proposed Data Schema

```typescript
// Proposed GeoJSON Feature Schema for Storm Cells
export interface StormCellFeature {
  type: "Feature";
  id: string; // "CELL-01"
  geometry: {
    type: "Polygon"; // Cell boundary contour
    coordinates: number[][][]; // [ [ [lon, lat], ... ] ]
  };
  properties: {
    cell_id: string; // e.g. "CELL-01"
    frame_idx: number; // 0 - 17
    time_offset_min: number; // 0 - 85

    // Directly measured from synthetic grid
    centroid_lat: number; // e.g. 13.0125
    centroid_lon: number; // e.g. 77.5420
    area_km2: number; // e.g. 74.3
    max_dbz: number; // e.g. 54.2
    mean_dbz: number; // e.g. 38.6
    intensity_class: "MODERATE" | "STRONG" | "SEVERE" | "EXTREME";

    // Derived algorithmically
    motion_u_kmh: number; // Eastward component (km/h)
    motion_v_kmh: number; // Northward component (km/h)
    speed_kmh: number; // Scalar speed (e.g. 22.8)
    bearing_deg: number; // Heading clockwise from North (e.g. 124°)
    status: "ACTIVE" | "GROWING" | "DECAYING";

    // Forecast projection (derived 15-30 min track)
    projected_path: Array<[number, number]>; // [ [lon, lat], ... ] for T+15, T+30
  };
}
```

- **Classification of Fields:**
  - **Directly Measured:** `centroid_lat`, `centroid_lon`, `area_km2`, `max_dbz`, `mean_dbz`, `polygon_contour`.
  - **Derived Algorithmically:** `cell_id`, `speed_kmh`, `bearing_deg`, `motion_u/v`, `intensity_class`, `projected_path`.
  - **Unsupported by Dataset (MUST NOT BE PROMISED):**
    - Vertically Integrated Liquid (VIL) — requires 3D radar tilts.
    - Echo Tops (ET) — requires vertical elevation scans.
    - Hail probability (POSH / MESH) — requires dual-polarization or environmental sounding temperatures.
    - Radial Doppler Velocity & Mesocyclone / Tornadic signatures — requires phase Doppler shift data.

### F. Proposed Mapbox Rendering Architecture
The recommended visualization requires **no third-party 3D graphics libraries** and integrates directly into the existing Mapbox GL JS map:

1. **GeoJSON Source:**
   - Add a single dynamic GeoJSON source: `storm-cells-source`.
   - Updated cleanly on `timeIdx` change (leveraging client-side caching of the pre-computed cell manifest).
2. **Layer Stack (placed above `radar-layer` and below UI controls):**
   - **Layer 1 (`storm-cells-hull`):** `fill` layer with low opacity ($0.2$) displaying cell boundary polygons, color-coded by severity.
   - **Layer 2 (`storm-cells-contour`):** `line` layer ($1.5\text{px}$) defining cell perimeters.
   - **Layer 3 (`storm-cells-vector`):** `line` layer with arrow heads / dashed stroke representing the 15–30 min projected track.
   - **Layer 4 (`storm-cells-centroid`):** `circle` layer ($6\text{px}$ to $10\text{px}$) highlighting cell centers with outer pulsing glow.
   - **Layer 5 (`storm-cells-labels`):** `symbol` layer with text layout showing `"{cell_id} | {max_dbz} dBZ | {speed_kmh} km/h"`.

### G. Known Limitations & Data Integrity Notes
1. **Synthetic Nature:** Cells originate from hardcoded Gaussian math equations ($z = I - 1.4 r^2$). Motion is artificially constant.
2. **Lack of Atmospheric Turbulence:** Real storms exhibit turbulent inflow, cell splitting, downburst dissipation, and non-linear steering. This procedural model does not simulate these physical dynamics.
3. **Limited Spatial & Temporal Coverage:** The domain is strictly a $48\text{ km} \times 54\text{ km}$ box around Bengaluru, lasting 85 minutes.
4. **Stationary Grid Artifacts:** Discretization on a $40 \times 40$ grid causes slight step-like jumps when integer rounding occurs at low speeds.
5. **Operational Labeling Requirement:** All UI overlays and API payloads must clearly bear the tag `"SYNTHETIC CELL TRACKING — DEMO ONLY"`.

### H. Exact Files That Will Need Modification in Phase 5
When Phase 5 is authorized for implementation, the following files will be touched or created:

1. **`src/services/storm_tracking.py`** *(New)*
   - Pure Python module to segment frames, compute centroids/metrics, associate cells across frames, and build GeoJSON features.
2. **`src/api/main.py`** *(Modify)*
   - Register new endpoint: `GET /api/radar/cells` (returns all 18 frames) or `GET /api/radar/cells/{time_idx}`.
3. **`ui/src/lib/mapbox.ts`** *(Modify)*
   - Add layer ID constants and Mapbox style layer definitions for cell boundaries, vectors, circles, and symbols.
4. **`ui/src/components/map/VajraMap.tsx`** *(Modify)*
   - Mount the `storm-cells-source` and associated layers during map initialization.
   - Sync GeoJSON feature data with playback `timeIdx`.
5. **`ui/src/components/map/MapControls.tsx`** *(Modify)*
   - Add a toggle switch to enable/disable Storm Cell Overlays & Track Vectors.
