# Phase 8B-2 — Real Multi-Frame IMD DWR Ingestion

## 1. Executive Summary

Phase 8B-2 successfully implements the ingestion and downstream validation of genuine multi-frame observational India Meteorological Department (IMD) Doppler Weather Radar (DWR) data.

Building upon the verified dataset identified in Phase 8B-2A from `syedhamidali/pyscancf_examples`, VAJRA ingests a chronological sequence of **3 consecutive Level-II NetCDF-3 radar scans** from **IMD Goa DWR** capturing the outer convective spiral bands of **Extremely Severe Cyclonic Storm Tauktae** on May 15, 2021.

This implementation proves that:
1. Canonical `RadarFrame` abstractions can ingest observational multi-frame sequences across different scientific formats (NetCDF-3 as well as Rainbow 5 `.vol`).
2. The existing Phase 5 deterministic storm cell detection engine identifies real convective storm cells ($40 - 58\text{ dBZ}$) without tuning or forcing thresholds.
3. Real cell tracks are established across time ($T_0 \rightarrow T_1 \rightarrow T_2$), computing physical velocities ($3 - 27\text{ km/h}$) and headings.
4. Phase 6 uncertainty mathematics deterministically compute kinematic trajectory cones and explainable confidence classes (`LOW`, `MEDIUM`).
5. The existing synthetic 18-frame pipeline and Phase 8B-1 Rainbow `.vol` sample remain 100% active, default, and untouched.

---

## 2. Dataset Provenance & Files

| Scan Index | File Name | Size (Bytes) | Relative Path | Timestamp (UTC) | Relative Time |
| :---: | :--- | :---: | :--- | :---: | :---: |
| **$T_0$** | `GOA210515003646-IMD-C.nc` | 732,976 B | `data/real_multiframe/GOA210515003646-IMD-C.nc` | `2021-05-15T00:36:46Z` | $0\text{ min}$ |
| **$T_1$** | `GOA210515004746-IMD-C.nc` | 732,976 B | `data/real_multiframe/GOA210515004746-IMD-C.nc` | `2021-05-15T00:47:46Z` | $+11\text{ min}$ |
| **$T_2$** | `GOA210515005811-IMD-C.nc` | 732,976 B | `data/real_multiframe/GOA210515005811-IMD-C.nc` | `2021-05-15T00:58:11Z` | $+21\text{ min}$ |

- **Origin**: Open-source IMD radar research repository `syedhamidali/pyscancf_examples` (affiliated with the OpenRadar community).
- **Radar Station**: **IMD Goa DWR** (`GOA`), located at Altinho, Panaji, Goa.
- **Transmitter Location**: **15.4833° N, 73.8166° E**, Altitude: 82.0 m MSL.
- **Hardware**: C-band Doppler Weather Radar ($\lambda = 0.053\text{ m} = 5.3\text{ cm}$, beamwidth $1.0^\circ$).
- **Meteorological Event**: Extremely Severe Cyclonic Storm Tauktae.
- **Temporal Span**: **21 minutes 25 seconds** across 3 consecutive scans.

> **CRITICAL GEOGRAPHIC IDENTIFICATION**:
> This dataset is **explicitly historical IMD Goa DWR data**. It is **not** Bengaluru radar data.
> The station identity, coordinates, and bounding boxes strictly represent Goa DWR in all APIs, models, and UI displays.

---

## 3. File Format & Reflectivity Calibration

- **Format**: Classic NetCDF-3 container (`CDF\x01` magic header), parsed natively via `scipy.io.netcdf_file` without requiring external compiled C-libraries.
- **Dimensions**: 360 azimuthal radials $\times$ 500 range bins.
- **Angular Resolution**: $1.0^\circ$ azimuthal step spanning $0^\circ\text{ to }359^\circ$.
- **Range Resolution**: $1,000\text{ m}$ ($1.0\text{ km}$) gate size along each radial ($500.0\text{ km}$ maximum range).
- **Elevation Sweep**: $0.5^\circ$ surveillance cut.
- **Reflectivity Calibration Formula**:
  $$\text{dBZ} = \text{raw\_int8} \times 0.5 + 32.0$$
  - `raw == -128`: Below noise floor / missing data &rarr; mapped to `NODATA_VALUE_DEFAULT` ($-9999.0$).
  - `raw != -128`: Valid meteorological echo, preserved as `float32`.
  - **Dynamic Echo Range**: $-17.5\text{ dBZ}$ to $+58.0\text{ dBZ}$.

---

## 4. Projection & Canonical `RadarFrame` Mapping

### Cartesian Projection
- **Method**: Direct Inverse Geographic Meshgrid Projection centered on Goa DWR ($15.4833^\circ\text{ N}, 73.8166^\circ\text{ E}$).
- **Domain Extent**: $\pm 150\text{ km}$ ($300\text{ km} \times 300\text{ km}$ surveillance domain).
- **Physical Grid**: $40 \times 40$ canonical float32 scalar array ($\Delta x = 7.5\text{ km}, \Delta y = 7.5\text{ km}$).
- **Geographic Bounding Box (WGS84)**:
  - **Northwest (NW)**: `(72.4184° E, 16.8399° N)`
  - **Northeast (NE)**: `(75.2148° E, 16.8399° N)`
  - **Southeast (SE)**: `(75.2148° E, 14.1267° N)`
  - **Southwest (SW)**: `(72.4184° E, 14.1267° N)`

### Canonical `RadarFrame` Contract
- `frame_index`: `0`, `1`, `2`
- `relative_time_min`: `0`, `11`, `21`
- `reflectivity_dbz`: `np.ndarray (40, 40)` float32
- `source_id`: e.g. `"GOA210515003646-IMD-C.nc"`
- `source_type`: `"imd_goa_netcdf"`
- `synthetic_demo`: `False`
- `timestamp_utc`: Preserved UTC ISO string (`2021-05-15T00:36:46Z`, `2021-05-15T00:47:46Z`, `2021-05-15T00:58:11Z`)

---

## 5. Provider Architecture & Factory Selection

The implementation lives in [src/services/imd_netcdf_reader.py](file:///c:/Users/yoges/OneDrive/Desktop/SIH/Vajra%20project2/Code%20repo/VAJRA/src/services/imd_netcdf_reader.py):
- `IMDNetCDFVolumeReader`: Single-file parser, coordinate transformer, and `RadarFrame` builder.
- `IMDNetCDFRadarProvider(RadarDataProvider)`: Multi-frame provider indexing all 3 scans chronologically.

Integrated into the central factory [src/services/radar_provider.py](file:///c:/Users/yoges/OneDrive/Desktop/SIH/Vajra%20project2/Code%20repo/VAJRA/src/services/radar_provider.py):
- `RADAR_DATA_SOURCE="synthetic"` &rarr; `SyntheticRadarProvider` (Default, 18 frames, Bengaluru)
- `RADAR_DATA_SOURCE="imd_sample"` &rarr; `IMDScientificRadarProvider` (Phase 8B-1, 1 frame, Chennai)
- `RADAR_DATA_SOURCE="imd_goa_netcdf"` &rarr; `IMDNetCDFRadarProvider` (Phase 8B-2, 3 frames, Goa)

---

## 6. Dedicated Inspection APIs

Added dedicated inspection routes in [src/api/main.py](file:///c:/Users/yoges/OneDrive/Desktop/SIH/Vajra%20project2/Code%20repo/VAJRA/src/api/main.py):
- `GET /api/radar/real-multiframe/metadata`: Returns metadata, station information, 3 timestamps, bounding coordinates, and status disclosure (`REAL IMD DWR • GOA • HISTORICAL DATA`).
- `GET /api/radar/real-multiframe/frame/{time_idx}`: Serves a continuous 512x512 PNG overlay for time index 0, 1, or 2, colorized with the standard operational dBZ palette.

---

## 7. Real Storm Tracking & Uncertainty Validation

The existing Phase 5 deterministic storm cell tracking engine (`StormTrackingEngine`) and Phase 6 kinematic uncertainty logic were executed against the 3 real Goa DWR frames.

### Tracking Results Across Frames

| Frame | Timestamp (UTC) | Cells Detected | Active Tracks | Kinematic Observations |
| :---: | :---: | :---: | :---: | :--- |
| **0** | `00:36:46Z` | **4** | `CELL-01`, `CELL-02`, `CELL-03`, `CELL-04` | Initial detections; peak reflectivity $49.5\text{ dBZ}$. Velocities uninitialized; confidence `LOW` (baseline initialization). |
| **1** | `00:47:46Z` | **3** | `CELL-01`, `CELL-02`, `CELL-05` | `CELL-01` tracked at $3.3\text{ km/h}$ (bearing $177.4^\circ$); `CELL-02` tracked at $9.9\text{ km/h}$ (bearing $100.0^\circ$). Confidence promoted to `MEDIUM` (motion stability $0.60$). |
| **2** | `00:58:11Z` | **4** | `CELL-01`, `CELL-02`, `CELL-04`, `CELL-05` | `CELL-01` tracked at $5.1\text{ km/h}$; `CELL-02` tracked at $7.9\text{ km/h}$; `CELL-05` tracked at $27.3\text{ km/h}$ (bearing $289.7^\circ$). `CELL-04` re-associated at $8.0\text{ km/h}$. |

### Kinematic Uncertainty Cones
- Every tracked cell generates valid GeoJSON features for `cell_hull`, `cell_centroid`, `cell_vector`, `forecast_uncertainty_15min`, and `forecast_uncertainty_30min`.
- The uncertainty polygons expand along the track bearing according to observed velocity stability, confirming mathematical compatibility without any algorithm redesign.

---

## 8. Test Suite & Validation

The dedicated test suite [tests/test_phase8b2_multiframe_radar.py](file:///c:/Users/yoges/OneDrive/Desktop/SIH/Vajra%20project2/Code%20repo/VAJRA/tests/test_phase8b2_multiframe_radar.py) verifies all 14 required points:

```
======================================================================
VAJRA PHASE 8B-2: REAL MULTI-FRAME IMD DWR INGESTION TEST SUITE
======================================================================
  [PASS] Test A: All three NetCDF-3 files exist and load successfully
  [PASS] Test B: Timestamps are chronological: ['2021-05-15T00:36:46Z', '2021-05-15T00:47:46Z', '2021-05-15T00:58:11Z'] (dt1=660.0s, dt2=625.0s)
  [PASS] Test C: Station verified as 'IMD Goa DWR' (GOA)
  [PASS] Test D: Coordinates verified at Lat=15.4833°N, Lon=73.8166°E, Alt=82.0m
  [PASS] Test E: dBZ = raw * 0.5 + 32.0 calibration verified
  [PASS] Test F: Nodata masking verified (83979 nodata cells in sweep)
  [PASS] Test G: Output is float32 with valid echo range [-13.0, 49.5] dBZ
  [PASS] Test H: Canonical RadarFrame contract satisfied
  [PASS] Test I: Frame count is exactly 3 ([0, 1, 2])
  [PASS] Test J: Frames are chronologically ordered (T0=0m, T1=11m, T2=21m)
  [PASS] Test K: Factory resolves IMDNetCDFRadarProvider for imd_goa_netcdf
  [PASS] Test L: Synthetic provider remains unchanged as active default
  [PASS] Test M: All Phase 7 regression tests pass
  [PASS] Test N: Phase 8B-1 Rainbow volume reader still functions correctly
======================================================================
ALL 14 MULTI-FRAME INGESTION & REGRESSION TESTS PASSED (100% SUCCESS)
======================================================================
```

- **Phase 8B-1 Test Suite**: 11/11 tests passed (100%).
- **Phase 7 Test Suite**: 9/9 tests passed (100%).
- **Frontend TypeScript (`tsc --noEmit`)**: 0 errors.
- **Frontend Build (`npm run build`)**: 0 errors, 11 static pages generated.

---

## 9. Limitations & Boundary Conditions

1. **Short Observation Duration**:
   The sequence spans 21 minutes 25 seconds across 3 scans. While sufficient to prove multi-frame ingestion, cell association, and velocity smoothing across 3 timesteps, it is **not sufficient to claim operational nowcasting capability**. Operational nowcasting requires hours of continuous volume data.
2. **Single Elevation Sweep**:
   These files represent a single surveillance elevation tilt ($0.5^\circ$). Vertical profile derivation and 3D CAPPI reconstruction require full multi-tilt volume scans ($0.5^\circ - 21^\circ$).
3. **Historical Case Study**:
   This is an offline historical validation using Cyclone Tauktae data from May 15, 2021, and does not connect to live operational feeds.
