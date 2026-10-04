# VAJRA Phase 8B-1: Real IMD DWR Single-Frame Ingestion Report

## 1. Executive Summary

Phase 8B-1 achieves the first end-to-end ingestion and rendering of genuine, observational India Meteorological Department (IMD) Doppler Weather Radar (DWR) data inside VAJRA's canonical architecture.

Using the verified Level-II volumetric radar dataset:
`data/2024050210404500dBZ.vol`
from IMD Chennai DWR, this phase proves that VAJRA's canonical `RadarFrame` abstraction can consume authentic scientific radar data without breaking or altering the existing 18-frame synthetic demonstration pipeline.

---

## 2. Source File & Physical Telemetry

| Parameter | Value | Verification |
| :--- | :--- | :--- |
| **Source File** | `data/2024050210404500dBZ.vol` | Verified on local filesystem (211,031 bytes) |
| **Origin Repository** | `bamkannan/WMO_RTC-2024ShortTermCourseOnRadar` | Public WMO RTC IMD Training archive |
| **Radar Station** | Chennai DWR (Port Radar) | Extracted from `<sensorinfo id="UNKNOWN" name="Chennai">` |
| **Geographic Origin** | **13.072833° N, 80.288333° E**, Alt: 53.0 m | Extracted from `<lat>`, `<lon>`, `<alt>` |
| **Radar Hardware** | Leonardo / Gematronik S-band DWR | Wavelength $\lambda = 0.104$ m (10.4 cm, ~2.88 GHz), Beamwidth $1.0^\circ$ |
| **Acquisition Timestamp** | **2024-05-02T10:40:45Z** (16:10:45 IST) | Extracted from `<scan date="2024-05-02" time="10:40:45">` |
| **File Format** | Rainbow 5 Volumetric XML + Compressed BLOBs | 20 binary BLOB chunks indexed and decompressed |
| **Compression** | `qt` (Qt zlib wrapper: 4-byte uncompressed size header + zlib) | Decompressed natively using Python standard library `zlib` |

---

## 3. Parser Architecture (`RainbowVolumeReader`)

### Zero-External-Compiled-Dependency Strategy
Rather than requiring heavy, platform-sensitive compiled C-libraries (Py-ART, wradlib, GDAL, or HDF5) which frequently face wheel compilation conflicts on Windows:
1. **XML Parsing**: Uses Python standard library `xml.etree.ElementTree` to parse radar geometry, range resolution, calibration coefficients, and BLOB offsets.
2. **Decompression**: Uses standard library `zlib` to decompress ray azimuth angles and raw reflectivity bytes in $<15\text{ ms}$.
3. **Array Processing**: Uses `numpy` for high-throughput vectorized coordinate transformations and polar-to-Cartesian resampling.

Implementation file: [rainbow_volume_reader.py](file:///c:/Users/yoges/OneDrive/Desktop/SIH/Vajra%20project2/Code%20repo/VAJRA/src/services/rainbow_volume_reader.py)

---

## 4. Original Radar Geometry vs. Cartesian Projection

### Original Polar Geometry (Sweep 0)
- **Elevation Angle**: $0.2^\circ$ (lowest surveillance tilt)
- **Azimuth Rays**: 361 rays spanning $0.0^\circ$ to $360.0^\circ$
- **Azimuth Encoding**: 16-bit big-endian unsigned integers:
  $$\theta = \text{raw\_uint16} \times \frac{360.0}{65536.0}$$
- **Range Gates**: 1,667 bins along each radial
- **Gate Spacing ($\Delta r$)**: 0.15 km (150 meters)
- **Maximum Range ($r_{\max}$)**: 250.0 km

### Calibration to Physical Reflectivity (dBZ)
Raw gate values are 8-bit unsigned integers calibrated via:
$$\text{dBZ} = \text{min} + \text{raw} \times \frac{\text{max} - \text{min}}{255.0} = -31.5 + \text{raw} \times \frac{127.0}{255.0}$$
- `raw == 0`: Nodata / below noise floor / out-of-range ($\rightarrow -9999.0$ dBZ).
- `raw > 0`: Valid meteorological echo.
- **Observed Dynamic Range**: **$-24.53\text{ dBZ}$ to $+69.10\text{ dBZ}$** (extreme convective storm core detected west-northwest of Chennai).

### Cartesian Projection Method
- **Method**: Direct Inverse Geographic Meshgrid Resampling.
- **Coordinate System**: Radar-centric metric grid spanning $[-150\text{ km}, +150\text{ km}]$ in both $X$ (East) and $Y$ (North).
- **Polar Mapping**:
  $$r = \sqrt{x^2 + y^2}, \quad \theta = \left(\text{degrees}(\arctan2(x, y)) + 360.0\right) \pmod{360^\circ}$$
- **Bin/Ray Lookup**:
  $$b = \left\lfloor \frac{r}{\Delta r} \right\rfloor, \quad \text{ray} = \left\lfloor \frac{\theta}{\Delta \theta} \right\rceil \pmod{N_{\text{rays}}}$$
- **Nodata Masking**: Explicit boolean `valid_mask` set to `False` for any pixel outside maximum range or where raw echo is below noise threshold.

---

## 5. Resulting Grid & Canonical `RadarFrame`

### Spatial Properties
- **Cartesian Grid Dimensions**: $40 \times 40$ (canonical default) and $100 \times 100$ (high-resolution test mode).
- **Domain Extent**: $300\text{ km} \times 300\text{ km}$ ($150\text{ km}$ radar radius).
- **Physical Resolution**:
  - $40 \times 40$: $\Delta x = 7.5\text{ km}$, $\Delta y = 7.5\text{ km}$.
  - $100 \times 100$: $\Delta x = 3.0\text{ km}$, $\Delta y = 3.0\text{ km}$.

### Geographic Bounding Box (WGS84)
The coordinates strictly represent the genuine Chennai DWR coverage:
- **Northwest (NW)**: `(78.9056° E, 14.4294° N)`
- **Northeast (NE)**: `(81.6711° E, 14.4294° N)`
- **Southeast (SE)**: `(81.6711° E, 11.7163° N)`
- **Southwest (SW)**: `(78.9056° E, 11.7163° N)`

> **CRITICAL COMPLIANCE**:
> This dataset is **never** cropped or relabeled as Bengaluru radar data. It is explicitly identified as:
> `REAL IMD DWR • CHENNAI • HISTORICAL SAMPLE`

### Canonical `RadarFrame` Field Mapping

| Field | Value | Notes |
| :--- | :--- | :--- |
| `frame_index` | `0` | Single-frame historical sample |
| `relative_time_min` | `0` | Baseline offset |
| `reflectivity_dbz` | `np.ndarray (40, 40)` float32 | Genuine scalar dBZ values |
| `width`, `height` | `40, 40` | Compatible with VAJRA processing grid |
| `geographic_bounds` | Chennai 4-corner polygon | Exact derived WGS84 coordinates |
| `spatial_resolution_km` | `{'dx': 7.5, 'dy': 7.5}` | Accurate physical gate spacing |
| `nodata_value` | `-9999.0` | Explicit sentinel |
| `valid_mask` | `np.ndarray (40, 40)` bool | `True` only where genuine echo exists |
| `min_dbz` | `10.45` dBZ | Minimum valid detected echo on grid |
| `max_dbz` | `55.66` dBZ | Convective storm peak reflectivity |
| `source_id` | `"2024050210404500dBZ.vol"` | Genuine source file identifier |
| `source_type` | `"dwr_sband_rainbow"` | Operational DWR format |
| `synthetic_demo` | `False` | Explicit non-synthetic indicator |
| `timestamp_utc` | `"2024-05-02T10:40:45Z"` | Preserved source timestamp |

---

## 6. Provider Architecture & Scope Isolation

```
                   RADAR_DATA_SOURCE Environment Variable
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │                                                   │
  "synthetic" (DEFAULT)                              "imd_sample" (OFFLINE TEST)
            │                                                   │
            ▼                                                   ▼
┌─────────────────────────┐                         ┌─────────────────────────┐
│  SyntheticRadarProvider │                         │IMDScientificRadarProvider│
│  (latest_forecast.npy)  │                         │ (2024050210404500dBZ.vol)│
│  - 18 frames            │                         │  - 1 frame (real scan)  │
│  - Bengaluru domain     │                         │  - Chennai domain       │
│  - SYNTHETIC • DEMO     │                         │  - REAL IMD DWR SAMPLE  │
└─────────────────────────┘                         └─────────────────────────┘
```

1. **Default Safety**: `SyntheticRadarProvider` remains the active default provider. The existing 18-frame playback, cell tracking, and uncertainty pipeline are 100% untouched.
2. **Offline Mode**: Setting `RADAR_DATA_SOURCE=imd_sample` resolves `IMDScientificRadarProvider`.
3. **Dedicated Endpoints**: Added `/api/radar/real-sample/metadata` and `/api/radar/real-sample/frame` to allow inspection and testing without changing configuration.
4. **UI Presentation**: Clearly displays `REAL IMD DWR • CHENNAI • HISTORICAL SAMPLE` with a verified live green status indicator (`#22c55e`), never showing `BENGALURU RADAR`.

---

## 7. Automated Test Suite (`tests/test_phase8b1_real_radar.py`)

A dedicated 11-point test suite was implemented and verified:

1. **Test 1 — File Exists**: Verified `data/2024050210404500dBZ.vol` exists (211,031 bytes).
2. **Test 2 — File Opens Successfully**: `RainbowVolumeReader` parsed XML manifest and indexed all 20 BLOBs.
3. **Test 3 — Reflectivity Field Exists**: Verified 2D polar matrix with shape `(361, 1667)`.
4. **Test 4 — Reflectivity is Scalar dBZ**: Verified `float32` calibrated values with physical range `[-24.53, 69.10]` dBZ.
5. **Test 5 — Radar Origin Available**: Verified station name `Chennai` and coordinates `(13.0728° N, 80.2883° E)`.
6. **Test 6 — Timestamp Available**: Verified `2024-05-02T10:40:45Z`.
7. **Test 7 — Cartesian Projection**: Resampled into 2D Cartesian grid with correct bounding box.
8. **Test 8 — RadarFrame Contract**: Generated canonical `RadarFrame` with `synthetic_demo=False`.
9. **Test 9 — Valid Mask**: Verified boolean mask distinguishing echo cells from `-9999.0` nodata cells.
10. **Test 10 — Provider Isolation**: Verified `SyntheticRadarProvider` default remains unchanged, while `RADAR_DATA_SOURCE=imd_sample` resolves `IMDScientificRadarProvider`.
11. **Test 11 — Regression Suite**: Executed all 9 Phase 7 regression tests; 100% passed.

---

## 8. Build & Verification Results

- **Python Tests**:
  - `tests/test_phase8b1_real_radar.py`: **11/11 PASSED (100%)**
  - `tests/test_phase7_radar_provider.py`: **9/9 PASSED (100%)**
- **Frontend TypeScript Validation**:
  - `npx --prefix ui tsc --noEmit -p ui/tsconfig.json`: **0 errors (Exit code 0)**
- **Next.js Production Build**:
  - `npm run build --prefix ui`: **Completed successfully**

---

## 9. Limitations & Phase 8B-2 Roadmap

1. **Single-Frame Temporal Snapshot**:
   - `2024050210404500dBZ.vol` represents a single volumetric scan at $T = 10:40:45\text{ UTC}$.
   - Because kinematic storm tracking (Phase 5) and nowcast uncertainty projection (Phase 6) require successive historical frames ($T_0, T_1, T_2, \dots$), multi-frame storm tracking on real observational data belongs to **Phase 8B-2**.
2. **Single Elevation Angle**:
   - The verified dataset provides a single tilt sweep ($0.2^\circ$). Future operational DWR adapters will ingest multi-tilt volume scans ($0.5^\circ, 1.0^\circ, 1.5^\circ, \dots, 21.0^\circ$) to synthesize 3D Constant Altitude Plan Position Indicator (CAPPI) and Maximum Reflectivity Composite (MAX-Z) fields.
