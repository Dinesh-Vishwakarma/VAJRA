# 🌩️ VAJRA: Vision-Aided Joint Radar & Atmospheric Nowcasting Engine

[![SIH 2024](https://img.shields.io/badge/SIH%20Problem%20ID-26072-orange.svg)](https://www.sih.gov.in/)
[![Ministry](https://img.shields.io/badge/Ministry-Earth%20Sciences%20(MoES)-blue.svg)](https://www.moes.gov.in/)
[![Department](https://img.shields.io/badge/Department-India%20Meteorological%20Department%20(IMD)-003366.svg)](https://mausam.imd.gov.in/)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel%20Live-000000?logo=vercel)](https://vajra-qpqb.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Railway%20Live-0B0D0E?logo=railway)](https://vajra-production-aad1.up.railway.app)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **Official Prototype for Smart India Hackathon (SIH)**  
> **Problem Statement ID:** 26072  
> **Title:** AIML based Nowcasting of thunderstorm and lightning using atmospheric observation including multiple radars, satellite, lightning and model data.  
> **Organization:** Ministry of Earth Sciences (MoES) | **Department:** India Meteorological Department (IMD)  
> **Category:** Software | **Theme:** Disaster Management  

---

## 📌 Executive Summary & Prototype Objective

**VAJRA** (*Vision-Aided Joint Radar & Atmospheric Nowcasting Engine*) is an operational prototype designed to address the critical hydrometeorological challenge of **sub-hourly thunderstorm, severe convection, and lightning nowcasting (0–2 hours)**.

Traditional Numerical Weather Prediction (NWP) models (such as GFS and NCMRWF unified models) operate on 3-to-6-hour assimilation cycles and cannot resolve the rapid genesis, intensification, and localized micro-physics of severe convective storms and cloudbursts.

VAJRA bridges this operational gap by implementing a **modular meteorological pipeline**:
1. **Radar Ingestion Abstraction (`RadarDataProvider`):** A strict boundary decoupling raw observation formats from downstream analytics via a canonical, physics-accurate `RadarFrame` representation.
2. **Scalar-Authoritative Processing:** Reflectivity ($Z \text{ in dBZ}$) is stored and manipulated as float32 Cartesian arrays; RGB visualizations are strictly downstream rendering artifacts.
3. **Automated Storm Cell Detection & Tracking:** Dynamic dBZ thresholding, connected-component labeling, spatial clustering, centroid velocity tracking, and track persistence.
4. **Kinematic Extrapolation & Uncertainty Nowcasting:** 15-minute and 30-minute kinematic cone projections with dynamic uncertainty radii based on storm acceleration and velocity stability.
5. **Operational 3D Workstation Frontend:** A Mapbox GL JS interface featuring 3D terrain, high-fidelity Doppler raster overlays, synchronized storm track vectors, and automated camera-follow during radar playback.

---

## 🏆 SIH Problem Statement Alignment

| Attribute | Specification |
| :--- | :--- |
| **Problem Statement ID** | **26072** |
| **Official Title** | AIML based Nowcasting of thunderstorm and lightning using atmospheric observation including multiple radars, satellite, lightning and model data |
| **Ministry / Organization** | Ministry of Earth Sciences (MoES) |
| **Department** | India Meteorological Department (IMD) |
| **Category / Theme** | Software / Disaster Management |

### Requirement Alignment & Implementation Status Matrix

To uphold scientific and engineering integrity, the capabilities of VAJRA are categorized into explicit operational tiers:

| SIH Requirement Component | VAJRA Implementation Component | Implementation Status | Evidence / Location |
| :--- | :--- | :--- | :--- |
| **Radar Ingestion Architecture** | `RadarDataProvider` abstract class, `RadarFrame` dataclass, Cartesian polar-to-grid | **IMPLEMENTED** | `src/services/radar_provider.py` |
| **Real IMD Radar File Ingestion** | Rainbow 5 (`.vol`) XML/binary BLOB reader for IMD DWR | **HISTORICAL VALIDATION** | `src/services/rainbow_volume_reader.py`, `data/2024050210404500dBZ.vol` |
| **Real Multi-Frame Radar Tracking** | NetCDF-3 sweeps ingestion for IMD Goa DWR (Cyclone Tauktae) | **HISTORICAL VALIDATION** | `src/services/imd_netcdf_reader.py`, `data/real_multiframe/` |
| **Live Operational Radar Feed** | Mock / Synthetic 18-frame Bengaluru convective sequence | **SYNTHETIC DEMO** | `src/services/radar_provider.py` (`SyntheticRadarProvider`) |
| **Storm Cell Detection** | 35 dBZ threshold, connected components, centroid/area extraction | **IMPLEMENTED** | `src/services/storm_tracking.py` (`detect_cells`) |
| **Temporal Storm Tracking** | Track association, velocity vectors, cell persistence, track IDs | **IMPLEMENTED** | `src/services/storm_tracking.py` (`track_cells`) |
| **Kinematic Nowcast (0–30 min)** | Constant-velocity extrapolation at $T+15\text{m}$ and $T+30\text{m}$ | **IMPLEMENTED** | `src/services/storm_tracking.py` (`project_cells`) |
| **Nowcast Uncertainty Cones** | Dynamic uncertainty radii based on tracking duration & velocity variance | **PROTOTYPE** | `src/services/storm_tracking.py`, `VajraMap.tsx` |
| **Interactive 3D Workstation** | Next.js, Mapbox GL JS 3D terrain/buildings, radar raster, camera-follow | **IMPLEMENTED** | `ui/src/components/map/VajraMap.tsx` |
| **Civil Defense & Operations UI** | Municipal pump control, ward vulnerability matrix, CAP v1.2 alerts | **PROTOTYPE** | `ui/src/app/disaster-ops/page.tsx` |
| **Aviation Aerodrome Monitoring** | Runway shear alerts, METAR/TAF decoders, corridor waypoints | **PROTOTYPE** | `ui/src/app/aviation/page.tsx` |
| **Multi-Radar Mosaic Fusion** | Gridded mosaic combining overlapping radar volumes | **PLANNED** | Roadmap Phase 9 |
| **INSAT-3DS Satellite Integration** | Real-time Rapid Cloud-Top Glaciation (TIR1/TIR2/WV) | **PLANNED** | Roadmap Phase 10 |
| **Lightning Detection Network** | Ground strike nowcasting using IMD / IITM lightning network | **PLANNED** | Roadmap Phase 11 |
| **Deep Learning Spatiotemporal Model**| Physics-informed U-Net / ConvLSTM trained on historical multi-year IMD archives | **PLANNED** | Roadmap Phase 12 |

---

## 🏛️ System Architecture

```
                 ┌─────────────────────────────────────────────────────────┐
                 │                   RADAR DATA SOURCES                    │
                 │  - Synthetic Convective Episode (Bengaluru - 18 frames) │
                 │  - IMD Chennai DWR Rainbow 5 Volume (2024-05-02 .vol)   │
                 │  - IMD Goa DWR NetCDF-3 Sweeps (Cyclone Tauktae 3-frame)│
                 └────────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                 ┌─────────────────────────────────────────────────────────┐
                 │             RadarDataProvider Ingestion Layer           │
                 │  - Calibrates physical reflectivity (dBZ)               │
                 │  - Converts polar coordinates to Cartesian grid         │
                 │  - Normalizes nodata sentinels and geographic bounds    │
                 └────────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                 ┌─────────────────────────────────────────────────────────┐
                 │                  CANONICAL RadarFrame                   │
                 │  - Authoritative 2D float32 scalar reflectivity array   │
                 │  - Georeferenced bounding box (NW / SE coordinates)     │
                 │  - Precise UTC timestamp & station metadata             │
                 └───────┬────────────────────┼────────────────────┬───────┘
                         │                    │                    │
                         ▼                    ▼                    ▼
     ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
     │  Radar Color Rendering │  │ Storm Detection/Track  │  │  Kinematic Nowcast     │
     │  - Scalar to RGBA PNG  │  │  - 35 dBZ threshold    │  │  - T+15m & T+30m cone  │
     │  - Standard IMD color  │  │  - Connected components│  │  - Uncertainty radius  │
     │    ramp calibration    │  │  - Persistent Track IDs│  │  - Motion stability    │
     └───────────┬────────────┘  └───────────┬────────────┘  └───────────┬────────────┘
                 │                           │                           │
                 │                           ▼                           │
                 │               ┌────────────────────────┐              │
                 │               │    GeoJSON Features    │              │
                 │               │  - Centroids & hulls   │              │
                 │               │  - Velocity vectors    │              │
                 │               │  - Severity categories │              │
                 │               └───────────┬────────────┘              │
                 │                           │                           │
                 └─────────────────────┐     │     ┌─────────────────────┘
                                       │     │     │
                                       ▼     ▼     ▼
                 ┌─────────────────────────────────────────────────────────┐
                 │               Mapbox GL JS 3D Workstation               │
                 │  - Doppler raster layer (slot: "top", updateImage)      │
                 │  - Centroid tracking & velocity vectors                 │
                 │  - Projected path & uncertainty polygons                │
                 │  - Automatic camera follow of active storm cell         │
                 │  - User interaction detection (disengages gracefully)   │
                 └─────────────────────────────────────────────────────────┘
```

### Core Architecture Principle: Scalar Reflectivity is Authoritative

In VAJRA, **the raw scalar array ($Z \text{ in dBZ}$) is the authoritative source of truth**. 
- Image rasters (PNGs) are **derived visualizations** generated on demand via scientific colormaps.
- Detection, tracking, intensity classification, and nowcasting operate **strictly on physical floating-point matrices**, never on lossy compressed pixel color channels.

---

## 📡 Radar Data Pipeline & Ingestion

### Supported Formats & Calibration

| Data Source | Format | Geometry | Calibration Formula | Nodata Handling | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bengaluru Demo** | NumPy Cartesian array | $40 \times 40$ grid ($0.05^\circ \approx 5.5\text{km}$) | Native dBZ scalar | Explicit $0.0\text{ dBZ}$ background | **Synthetic Demo** |
| **IMD Chennai DWR** | Selex Rainbow 5 (`.vol`) | Polar ($361 \text{ rays} \times 1667 \text{ bins}$) | XML header linear scale factor | Masked invalid bytes ($< -32\text{ dBZ}$) | **Historical Validation** |
| **IMD Goa DWR** | NetCDF-3 CF radial sweep | Polar ($360 \text{ rays} \times 500 \text{ bins}$) | $\text{dBZ} = \text{raw} \times 0.5 + 32.0$ | Sentinel $-128 \rightarrow \text{NaN} / 0.0$ | **Historical Validation** |

### Polar to Cartesian Transformation

For polar radar sweeps, VAJRA computes geographic coordinates for each ray bin:
$$\text{Range} = r \times \Delta r, \quad \theta = \text{Azimuth Angle}$$
$$\text{Lat}_{\text{bin}} = \text{Lat}_{\text{radar}} + \frac{r \cos(\theta)}{111139}, \quad \text{Lon}_{\text{bin}} = \text{Lon}_{\text{radar}} + \frac{r \sin(\theta)}{111139 \cos(\text{Lat}_{\text{radar}})}$$

Data points are interpolated onto a uniform Cartesian grid using fast nearest-neighbor or bilinear splatting with strict bounds checking.

---

## ⚡ Storm Cell Detection & Temporal Tracking

The core tracking engine (`src/services/storm_tracking.py`) executes five sequential stages:

```
Scalar Reflectivity Grid
          ↓
[1] Binary Thresholding (Z >= 35 dBZ)
          ↓
[2] 8-Connected Component Labeling & Core Filtering (Area >= 3 pixels)
          ↓
[3] Metric Computation (dBZ max, dBZ mean, Pixel Area, Geometric Centroid)
          ↓
[4] Coordinate Projection (Grid indices -> WGS84 Longitude / Latitude)
          ↓
[5] Temporal Track Association (Euclidean matching across consecutive frames)
          ↓
Persistent Track IDs (CELL-01, CELL-02) + Motion Vectors (km/h & bearing)
```

1. **Thresholding:** Isolates convective cores using the meteorologically standard severe convection boundary ($Z \ge 35\text{ dBZ}$).
2. **Connected Components:** Clusters contiguous pixels using 8-connectivity. Small isolated noise clusters ($< 3\text{ pixels}$) are rejected.
3. **Centroid & Area Calculation:** Computes center of mass weighted by reflectivity intensity.
4. **Geographic Conversion:** Converts grid row/column coordinates to geodetic WGS-84 coordinates based on the radar frame bounding box.
5. **Track Association:** Computes distance matrices between frame $T_{k-1}$ and $T_k$. Cells within a maximum search radius ($35\text{ km}$) are matched and preserve their identity (`CELL-XX`). Motion vectors ($\Delta x, \Delta y$, speed in km/h, and heading) are calculated dynamically using the exact elapsed time $\Delta t$.

---

## 🔮 Kinematic Nowcasting & Uncertainty Cones

VAJRA provides short-term (0–30 minute) convective extrapolation:
- **15-Minute Kinematic Forecast:** Projected centroid based on linear motion extrapolation:
  $$\vec{P}_{15} = \vec{P}_0 + \vec{v} \times 900\text{s}$$
- **30-Minute Kinematic Forecast:** Projected centroid at 30 minutes:
  $$\vec{P}_{30} = \vec{P}_0 + \vec{v} \times 1800\text{s}$$

### Uncertainty Modeling (Honest Disclosure)

> [!NOTE]
> **Deterministic Kinematic Uncertainty:** The uncertainty boundaries displayed by VAJRA are **geometric kinematic cones**, calculated from velocity variance and track history. They are **not** a calibrated 95% Bayesian confidence interval or an ensemble ML probability distribution.

The uncertainty radius $R(t)$ expands forward in time:
$$R(t) = R_{\text{base}} + \alpha \cdot t \cdot (1 + \sigma_v)$$
Where:
- $R_{\text{base}}$ is proportional to the current cell radius.
- $\sigma_v$ is the velocity instability factor (higher when cells rapidly change direction or speed).
- Confidence is classified into three categories: **HIGH** (stable track $\ge 3$ frames), **MEDIUM** (track established for 2 frames), and **LOW** (newly detected cell).

---

## 🔬 Real IMD Radar Validation Studies

VAJRA's architecture and algorithms have been validated against two genuine historical IMD radar datasets:

### 1. Single-Frame Validation: IMD Chennai DWR
- **File:** `data/2024050210404500dBZ.vol`
- **Station:** IMD Chennai DWR (Station code: `CHENNAI`, Lat: $13.0728^\circ\text{N}$, Lon: $80.2883^\circ\text{E}$)
- **Timestamp:** 2024-05-02T10:40:45Z
- **Format:** Selex Rainbow 5 XML + binary compressed BLOBs
- **Validation Results:** Successfully decompressed 20 internal binary BLOBs, extracted raw $361 \times 1667$ polar reflectivity field with physical range $[-24.5, 69.1]\text{ dBZ}$, transformed to $100 \times 100$ Cartesian grid, generated canonical `RadarFrame` (peak $55.66\text{ dBZ}$).
- **Automated Test:** `tests/test_phase8b1_real_radar.py` (11/11 tests pass).

### 2. Multi-Frame Validation: IMD Goa DWR (Cyclone Tauktae)
- **Files:** `data/real_multiframe/` (`GOA210515003646-IMD-C.nc`, `GOA210515004746-IMD-C.nc`, `GOA210515005811-IMD-C.nc`)
- **Station:** IMD Goa DWR (Station code: `GOA`, Lat: $15.4833^\circ\text{N}$, Lon: $73.8166^\circ\text{E}$, Alt: $82\text{m}$)
- **Timestamps:** 2021-05-15T00:36:46Z, 00:47:46Z, 00:58:11Z (Span: 21m 25s, $\Delta t_1 = 660\text{s}$, $\Delta t_2 = 625\text{s}$)
- **Meteorological Event:** Extremely Severe Cyclonic Storm Tauktae outer convective bands.
- **Validation Results:** Verified NetCDF-3 radial sweep ingestion, physical calibration ($\text{dBZ} = \text{raw} \times 0.5 + 32.0$), nodata masking, and generalized storm cell tracking across all 3 real consecutive sweeps.
- **Automated Tests:** `tests/test_phase8b2_multiframe_radar.py` (14/14 tests pass), `tests/test_phase8b3_tracking_generalization.py` (6/6 tests pass).

*Limitation Notice: These datasets validate the ingestion pipeline and tracking logic on real IMD instruments; they do not represent real-time Bengaluru radar.*

---

## 🏙️ Bengaluru Convective Demonstration

The live interactive interface showcases a high-resolution 18-frame convective episode over Bengaluru:
- **Spatial Coverage:** $12.75^\circ\text{N} - 13.15^\circ\text{N}, 77.40^\circ\text{E} - 77.80^\circ\text{E}$ (Greater Bengaluru Metropolitan Area).
- **Temporal Sequence:** 18 frames at 5-minute intervals ($T+0\text{m}$ to $T+85\text{m}$).
- **Convective Evolution:**
  - $T+0$ to $T+20$: Cell genesis in NW Bengaluru (Peenya / Jalahalli, $42\text{ dBZ}$).
  - $T+25$ to $T+50$: Explosive intensification into severe thunderstorm ($65\text{ dBZ}$, hail risk) tracking southeast towards the CBD and Bellandur.
  - $T+55$ to $T+85$: Secondary cell development and convective outflow dissipation.
- **Status Disclosure:** Clearly labeled on the UI with the **"SYNTHETIC • DEMO"** disclosure badge.

---

## 💻 Frontend Architecture & Features

Built with **Next.js 16 (App Router)** and **Mapbox GL JS**:

- **Default Viewport Framing:** Calibrated initial camera framing Bengaluru at `zoom: 10.6`, `pitch: 20`, `bearing: 0`, centering the urban core with full radar coverage.
- **Radar Raster Overlay:** High-performance dynamic raster layer positioned at `slot: "top"` with reactive `updateImage()` updates, preventing Mapbox re-renders or screen blinking during playback.
- **Radar Playback Camera Follow:**
  - When playback is active (`isPlaying=true`), the camera smoothly tracks the centroid of the primary active cell (`CELL-01`) using `map.easeTo({ duration: 750 })`.
  - **Track Lock:** Locks onto the tracked cell ID across frames to prevent erratic jumping caused by minor intensity fluctuations in secondary cells.
  - **Non-Fighting Interaction:** Detects user manual gestures (`dragstart`, `zoomstart`, `rotatestart`, `pitchstart`) and temporarily disengages camera follow so the user maintains full control.
- **Tactical Meteorological HUD:** Floating glassmorphic top-bar, collapsible layer controls, WMO/IMD-standard dBZ color ramp, and interactive time slider with speed presets ($1\times, 2\times, 4\times$).

---

## ⚙️ Backend Architecture & Services

The backend is built with **FastAPI** (`src/api/main.py`):

```
FastAPI Router
  ├── /health                           (System health, provider mode, model status)
  ├── /api/radar/metadata               (Active radar provider metadata & bounds)
  ├── /api/radar/frame/{time_idx}       (RGBA radar reflectivity PNG overlay)
  ├── /api/radar/cells/{time_idx}       (GeoJSON centroids, hulls, tracks & nowcast)
  ├── /api/nowcast                      (Real-time station telemetry & alerts)
  ├── /api/disaster-ops/*               (Ward flood vulnerability & pump controls)
  ├── /api/aviation/*                   (Aerodrome runway status & METAR/TAF decoders)
  └── /api/thermodynamics/*             (Atmospheric sounding profiles & instability indices)
```

- **Clean Provider Abstraction:** Switch between `SyntheticRadarProvider`, `RainbowVolumeRadarProvider`, and `IMDNetCDFRadarProvider` without altering downstream endpoints.
- **Zero-Copy Serialization:** Reflectivity PNGs and GeoJSON payloads are generated in memory and streamed directly to clients.

---

## ☁️ Deployment Architecture

- **Frontend:** Hosted on **Vercel** ([https://vajra-qpqb.vercel.app](https://vajra-qpqb.vercel.app)). Edge-optimized Next.js runtime with defensive API URL sanitization (`sanitizeApiUrl`).
- **Backend:** Hosted on **Railway** ([https://vajra-production-aad1.up.railway.app](https://vajra-production-aad1.up.railway.app)). Containerized Python FastAPI server with automatic health monitoring and CORS policy handling.

---

## 📂 Repository Structure

```
VAJRA/
├── .env.example                 # Sanitized environment configuration template
├── .gitignore                   # Comprehensive exclusion file (secrets, caches, builds)
├── Dockerfile.backend           # Container configuration for FastAPI
├── Dockerfile.frontend          # Container configuration for Next.js
├── README.md                    # Authoritative SIH technical documentation
├── data/
│   ├── 2024050210404500dBZ.vol  # IMD Chennai DWR Rainbow 5 volume scan (Phase 8B-1)
│   └── real_multiframe/         # IMD Goa DWR NetCDF-3 volume scans (Phase 8B-2)
│       ├── GOA210515003646-IMD-C.nc
│       ├── GOA210515004746-IMD-C.nc
│       └── GOA210515005811-IMD-C.nc
├── docs/                        # Engineering phase audit reports & diagrams
├── requirements.txt             # Backend Python dependencies
├── src/
│   ├── api/
│   │   ├── main.py              # FastAPI application & route endpoints
│   │   └── onnx_exporter.py     # ONNX runtime integration
│   └── services/
│       ├── radar_provider.py    # RadarDataProvider abstraction & synthetic engine
│       ├── rainbow_volume_reader.py # Selex Rainbow 5 binary volume parser
│       ├── imd_netcdf_reader.py # NetCDF-3 radar sweep parser
│       └── storm_tracking.py    # Convective cell detection, tracking & nowcasting
├── tests/
│   ├── test_phase7_radar_provider.py
│   ├── test_phase8b1_real_radar.py
│   ├── test_phase8b2_multiframe_radar.py
│   └── test_phase8b3_tracking_generalization.py
└── ui/
    ├── package.json             # Next.js frontend dependencies
    ├── next.config.ts           # Next.js configuration & environment forwarding
    └── src/
        ├── app/                 # Next.js App Router pages
        │   ├── page.tsx         # Live Radar Command Center
        │   ├── disaster-ops/    # Municipal Disaster Operations
        │   ├── aviation/        # Aviation Weather Safety
        │   ├── thermodynamics/  # Soundings & Instability Indices
        │   ├── replay/          # Historical Case Replay
        │   └── analytics/       # Verification Metrics & CSI Scores
        ├── components/map/
        │   ├── VajraMap.tsx     # Mapbox GL JS map, raster layer & camera follow
        │   ├── MapControls.tsx  # Layer & visual toggles
        │   └── MapLegend.tsx    # WMO/IMD dBZ color scale & status disclosure
        └── lib/
            ├── api.ts           # Frontend API client with URL sanitization
            └── mapbox.ts        # Mapbox tokens, viewport presets & layers
```

---

## 🛠️ Local Development & Setup

### 1. Prerequisites
- **Python:** 3.11 or 3.12
- **Node.js:** 18.x or 20.x
- **Mapbox Token:** Free public access token from [Mapbox](https://account.mapbox.com/)

### 2. Backend Setup
```bash
# Navigate to repository root
git clone https://github.com/Dinesh-Vishwakarma/VAJRA.git
cd VAJRA

# Create and activate Python virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI backend server
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd ui

# Install dependencies
npm install

# Configure environment variables
# Create ui/.env.local and add:
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_public_token

# Run Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Running Backend Tests
```bash
# Execute full validation suite (from repo root with venv active)
python tests/test_phase7_radar_provider.py
python tests/test_phase8b1_real_radar.py
python tests/test_phase8b2_multiframe_radar.py
python tests/test_phase8b3_tracking_generalization.py
```

### 5. Production Build Verification
```bash
cd ui
npm run build
```

---

## 📖 API Documentation

| Method | Endpoint | Parameters | Purpose | Response Format |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | System status & model readiness | JSON (`status`, `provider`, `cells_available`) |
| `GET` | `/api/radar/metadata` | None | Radar metadata, bounds & frame count | JSON (`station_name`, `bbox`, `frames`, `synthetic_demo`) |
| `GET` | `/api/radar/frame/{time_idx}` | `time_idx` (0-17) | Georeferenced radar reflectivity overlay | Binary `image/png` |
| `GET` | `/api/radar/cells/{time_idx}` | `time_idx` (0-17) | Storm cell polygons, tracks & nowcast cones | Standard `GeoJSON FeatureCollection` |
| `GET` | `/api/nowcast` | None | Sector convective metrics & alerts | JSON (`alerts`, `time_series`, `current_dbz`) |
| `GET` | `/api/disaster-ops/wards` | None | Municipal ward flood vulnerability | JSON array of ward flood states |
| `POST` | `/api/disaster-ops/pumps/{id}/toggle` | `id` (ward id) | Toggle municipal stormwater drainage pump | JSON (`status`, `new_state`) |
| `GET` | `/api/aviation/airports` | None | Runway wind shear & microburst hazard | JSON array of aerodrome statuses |
| `GET` | `/api/thermodynamics/indices/{station}` | `station` | Atmospheric instability indices (CAPE, etc.) | JSON (`cape`, `cin`, `bulk_shear`, `pwat`) |

---

## 🧪 Testing & Validation Results

| Test Suite | Focus Area | Result | Details |
| :--- | :--- | :--- | :--- |
| `test_phase7_radar_provider.py` | Radar Ingestion Abstraction | **9/9 PASSED** | Verified canonical bounds, 40x40 grid, PNG generation |
| `test_phase8b1_real_radar.py` | IMD Chennai Rainbow 5 Parser | **11/11 PASSED** | Verified XML/BLOB extraction, Cartesian projection |
| `test_phase8b2_multiframe_radar.py`| IMD Goa NetCDF-3 Parser | **14/14 PASSED** | Verified 3 consecutive sweeps, calibration, nodata |
| `test_phase8b3_tracking_generalization.py`| Generalization & Tracking | **6/6 PASSED** | Verified dynamic pixel sizes, velocities & non-BLR grids |
| **Frontend Production Build** | TypeScript & Turbopack Bundle | **PASSED (0 errors)**| Next.js 16 build succeeded with all static routes |

---

## ⚠️ Limitations & Scientific Transparency

In strict adherence to scientific integrity, the following operational limitations are documented:
1. **Synthetic Bengaluru Sequence:** The interactive Bengaluru demonstration utilizes a 18-frame synthetic sequence designed from meteorological principles. It is **not** connected to an operational live IMD radar feed.
2. **Historical Validation Scope:** Real IMD DWR validation was performed on historical archive files (Chennai May 2024 and Goa Cyclone Tauktae May 2021). These prove that the parsing and tracking pipeline works on genuine IMD instruments, but they are not live feeds.
3. **Deterministic Kinematic Nowcasting:** The current nowcasting engine uses linear velocity extrapolation. It does **not** yet model convective non-linear initiation, rapid dissipation, or cloud micro-physics.
4. **No Calibrated AI Confidence:** Uncertainty polygons represent geometric motion cones, not calibrated 95% Bayesian or deep learning confidence bounds.
5. **Satellite & Lightning Streams:** INSAT-3DS and ground lightning feeds are architecturally designed and documented in future roadmap phases, but are not actively ingesting real-time data in this prototype pass.

---

## 🗺️ Future Roadmap (SIH Evolution)

- **Phase 9: Multi-Radar Mosaic Engine:** Grid composite stitching across adjacent IMD radars (e.g., Bengaluru + Chennai + Kochi) to eliminate cone-of-silence and beam-blockage gaps.
- **Phase 10: INSAT-3DS Rapid Glaciation Pipeline:** Ingestion of geostationary thermal infrared (TIR1, TIR2) channels to detect rapid cloud-top cooling 30 minutes before radar echo emergence.
- **Phase 11: Lightning Network Integration:** Ingestion of IITM / IMD lightning detection network pulses for automated cloud-to-ground strike nowcasting.
- **Phase 12: Physics-Informed Spatiotemporal AI (U-Net / ConvLSTM):** Training deep learning models on multi-year IMD archives with mass and vorticity conservation constraints.
- **Phase 13: Operational NDMA CAP v1.2 Gateway:** Direct integration with state disaster management authority warning networks.

---

## 🔒 Security & Environment Hardening

- **Zero Hardcoded Secrets:** All API keys, database credentials, and access tokens are managed strictly via environment variables.
- **Client-Side Token Protection:** The Mapbox access token is restricted to public browser map rendering (`pk.*`).
- **Defensive URL Sanitization:** Frontend incorporates `sanitizeApiUrl()` to protect against accidental prefix injection, duplicated protocols, or misconfigured environment variables.
- **Clean Exclusion:** `.gitignore` strictly blocks all `.env*` files (except `.env.example`), `.venv`, node modules, debug logs, and build artifacts.

---

## 🎬 SIH Judge Demonstration Flow (Recommended Walkthrough)

To review VAJRA's capabilities during hackathon evaluation, follow this 11-step sequence:

1. **Open VAJRA Dashboard:** Navigate to [https://vajra-qpqb.vercel.app](https://vajra-qpqb.vercel.app).
2. **Review Default Camera Framing:** Observe the calibrated initial 3D Mapbox camera framing Bengaluru (`zoom: 10.6`, `pitch: 20`).
3. **Inspect Radar Overlay:** Note the georeferenced Doppler reflectivity overlay and standard IMD/WMO color ramp (20 to 65+ dBZ).
4. **Start Playback:** Click the **Play** button on the bottom timeline scrubber.
5. **Observe Camera Follow:** Watch the camera smoothly ease toward the intensifying storm cell (`CELL-01`) as it develops and moves southeastward.
6. **Test Non-Fighting Interaction:** Manually pan or zoom the map during playback; verify that the camera follow gracefully disengages without fighting the user.
7. **Examine Storm Tracking:** Click the **Storm Cells** toggle to view detected core hulls, centroid markers, and velocity vectors.
8. **Inspect Nowcast Cones:** Observe the projected 15-minute and 30-minute kinematic positions with dynamic uncertainty cones.
9. **Review Real IMD Validation:** Highlight the successful parsing and validation on real IMD Chennai (`.vol`) and IMD Goa (`.nc`) datasets (`tests/` and `docs/`).
10. **Explain Transparency & Status:** Point out the **"SYNTHETIC • DEMO"** disclosure badge, explaining that Bengaluru radar is a realistic demonstration while IMD ingestion has been validated on historical data.
11. **Walk Through Operational Dashboards:** Briefly showcase `/disaster-ops` (ward flood pumps & CAP alerts) and `/aviation` (runway wind shear & METAR decoders).

---

## 📜 License & Citations
This project is developed for the **Smart India Hackathon (SIH)** under the **MIT License**.  
Radar research datasets utilized for historical validation courtesy of India Meteorological Department (IMD) open research archives and `syedhamidali/pyscancf_examples`.
