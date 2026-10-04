# VAJRA — Phase 7: Radar Data Ingestion Abstraction

> **ARCHITECTURAL RULE:**  
> **"Radar processing operates on canonical scalar reflectivity data. Rendering formats such as PNG are derived products and are never the authoritative radar data source."**

---

## 1. Executive Summary

Phase 7 establishes a decoupled, provider-agnostic radar data ingestion architecture for the VAJRA Nowcasting Engine. Prior to Phase 7, procedural forecast arrays (`latest_forecast.npy`) were coupled directly into FastAPI routes and storm tracking modules. 

With Phase 7:
1. All downstream consumers—including **PNG raster colorizers**, **storm-cell segmentation**, **DBSCAN/convex-hull tracking**, and **kinematic nowcast uncertainty envelopes**—consume a single authoritative, georeferenced **`RadarFrame`** dataclass containing scalar equivalent reflectivity factor ($Z_e$ in dBZ).
2. The baseline procedural dataset is isolated behind **`SyntheticRadarProvider`**, preserving 100% numerical fidelity and spatial characteristics.
3. Clean extension points (**`DWRRadarProvider`**, **`IMDRadarProvider`**) define strict contracts for future observational radar telemetry without requiring rewrites of Phases 2–6.
4. Operational transparency is enforced across the UI via a dynamic source badge deriving from `GET /api/radar/metadata`.

```
                        ┌───────────────────────────────────────────────┐
                        │              RADAR_DATA_SOURCE                │
                        │       ('synthetic' | 'dwr' | 'imd')           │
                        └──────────────────────┬────────────────────────┘
                                               │
                                       get_radar_provider()
                                               │
                        ┌──────────────────────▼────────────────────────┐
                        │              RadarDataProvider                │
                        │   - get_frame(index) -> RadarFrame            │
                        │   - get_available_frames() -> List[int]       │
                        │   - get_metadata() -> Dict[str, Any]          │
                        └──────┬───────────────────────┬────────────────┘
                               │                       │
               ┌───────────────▼────────────┐ ┌────────▼────────────────┐
               │   SyntheticRadarProvider   │ │ DWR / IMD Provider      │
               │ (latest_forecast.npy demo) │ │ (Future Extension Point)│
               └───────────────┬────────────┘ └─────────────────────────┘
                               │
                       Authoritative Scalar
                           RadarFrame
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
┌──────▼───────┐       ┌───────▼────────┐       ┌───────▼────────┐
│ PNG Raster   │       │ Cell Detection │       │ Kinematic      │
│ Colorizer    │       │ & Tracking     │       │ Nowcast &      │
│ (/api/radar/ │       │ (Phase 5)      │       │ Uncertainty    │
│  frame/{t})  │       │                │       │ (Phase 6)      │
└──────┬───────┘       └───────┬────────┘       └───────┬────────┘
       │                       │                        │
       └───────────────────────┼────────────────────────┘
                               │
                     Mapbox 3D Workstation
                     & Operational UI
```

---

## 2. Canonical RadarFrame Schema

The canonical `RadarFrame` (`src/services/radar_provider.py`) holds raw scalar reflectivity values with physical coordinates and quality masks.

```python
@dataclass
class RadarFrame:
    frame_index: int                       # 0-indexed temporal step (e.g. 0 to 17)
    relative_time_min: int                 # Offset from T0 in minutes (e.g. 0 to 85)
    reflectivity_dbz: np.ndarray          # 2D float32 scalar array (H, W) in dBZ
    width: int                             # Grid width (default: 40)
    height: int                            # Grid height (default: 40)
    geographic_bounds: List[Tuple[float, float]]  # Canonical 4 corners [NW, NE, SE, SW]
    spatial_resolution_km: Dict[str, float]       # {'dx': float, 'dy': float} (~1.35 km, ~1.21 km)
    nodata_value: float                    # Sentinel nodata value (-9999.0)
    valid_mask: np.ndarray                 # 2D boolean array (True where echo is physically valid)
    min_dbz: float                         # Minimum valid dBZ in frame
    max_dbz: float                         # Maximum valid dBZ in frame
    source_id: str                         # Identifier (e.g., 'latest_forecast.npy')
    source_type: str                       # 'synthetic' | 'dwr_cband' | 'imd_maxz'
    synthetic_demo: bool = True            # Operational disclaimer flag
    timestamp_utc: Optional[str] = None    # ISO 8601 UTC timestamp when observational
```

### Spatial Grid Georeferencing
The canonical extent covers the Greater Bengaluru Metropolitan Area:
- **Northwest (NW):** `[77.3446° E, 13.1916° N]`
- **Northeast (NE):** `[77.8446° E, 13.1916° N]`
- **Southeast (SE):** `[77.8446° E, 12.7516° N]`
- **Southwest (SW):** `[77.3446° E, 12.7516° N]`
- **Grid Dimensions:** $40 \times 40$ cells
- **Resolution:** $dx \approx 1.3585\text{ km}$, $dy \approx 1.2170\text{ km}$ ($~1.653\text{ km}^2$ per pixel)

---

## 3. Data Quality & NoData Handling

Raw Doppler radar data contains missing beams, cone of silence, ground clutter, and non-finite values. The validation utility `validate_reflectivity_field` guarantees data integrity before downstream consumption:

1. **Non-finite Values:** `NaN`, `+Inf`, and `-Inf` are tagged invalid.
2. **Sentinel Missing Values:** Values $\le -900.0$ are flagged as missing.
3. **Physical Plausibility Bounds:** Values outside the meteorological interval $[-30.0, 95.0]\text{ dBZ}$ are treated as instrument artifacts or corrupted data.
4. **NoData Preservation:** Invalid pixels are assigned `nodata_value = -9999.0` and marked `False` in `valid_mask`.
5. **Downstream Safety:** `frame.get_valid_reflectivity()` returns a copy where invalid values are clamped to `0.0 dBZ` for thresholding algorithms, preventing silent NaN propagation in OpenCV/SciPy contouring.

---

## 4. Provider Implementations

### SyntheticRadarProvider (Active)
- Wraps the baseline procedural Gaussian advection model stored at `data/processed/latest_forecast.npy`.
- Thread-safe lazy loading with memoization cache.
- Delivers 18 frames at 5-minute intervals ($T+0$ to $T+85\text{ min}$).
- Preserves 100% of existing numerical values ($0.0$ to $65.0\text{ dBZ}$) without regeneration.

### Future Real-Data Providers (Stubs & Extension Points)

#### DWRRadarProvider (Doppler Weather Radar)
When connecting to physical C-band/S-band radar hardware (e.g. IMD DWR Bangalore):
- **Polar-to-Cartesian Transformation:** Project spherical polar coordinates $(r, \theta, \phi)$ to WGS84 Cartesian grid.
- **Sweep Processing:** Compute Constant Altitude PPI (CAPPI) or Column Maximum Reflectivity (MAX-Z) across antenna elevation tilts ($0.5^\circ$ to $19.5^\circ$).
- **Dual-Pol Quality Control:** Filter anomalous propagation (AP), biological scatterers (birds/insects), and solar interference using correlation coefficient $\rho_{hv} < 0.8$.
- **Attenuation Correction:** Apply path-integrated specific differential phase ($K_{dp}$) correction for rain-induced path attenuation.

#### IMDRadarProvider (Gridded Mosaic Ingestion)
When ingesting gridded HDF5/GeoTIFF composites from national meteorological portals:
- **Spatial Subsetting:** Extract the $40 \times 40$ regional bbox covering Bengaluru Urban & Rural.
- **Calibration Offsets:** Convert raw unsigned byte integers to physical dBZ via gain/offset metadata.
- **Latency & Gap Mitigation:** Gracefully flag delayed scans rather than failing abruptly.

---

## 5. API Metadata Contract

### `GET /api/radar/metadata`
Exposes the authoritative radar provider state:

```json
{
  "source_type": "synthetic",
  "source_id": "latest_forecast.npy",
  "provider_class": "SyntheticRadarProvider",
  "synthetic_demo": true,
  "status_disclosure": "SYNTHETIC DATA — DEMO ONLY",
  "disclaimer": "Synthetic procedural Gaussian advection model. Not real observational radar.",
  "frame_count": 18,
  "interval_minutes": 5,
  "temporal_range": {
    "start_offset_min": 0,
    "end_offset_min": 85
  },
  "grid": {
    "width": 40,
    "height": 40
  },
  "units": "dBZ",
  "valid_range": {
    "min_dbz": 0.0,
    "max_dbz": 65.0
  },
  "nodata_value": -9999.0,
  "bounds": [
    [77.3446, 13.1916],
    [77.8446, 13.1916],
    [77.8446, 12.7516],
    [77.3446, 12.7516]
  ],
  "spatial_resolution_km": {
    "dx": 1.3585,
    "dy": 1.2170
  }
}
```

---

## 6. Frontend Operational Source Disclosure

The user interface displays an operational status badge:
- **Top Bar Header:** Subtle badge next to the logo reading `DATA SOURCE: SYNTHETIC • DEMO` with an amber indicator dot.
- **Map Legend Footer:** Integrated status readout at the bottom of the dBZ colormap.
- **Single Source of Truth:** Both components derive dynamically from `/api/radar/metadata` via `fetchRadarMetadata()` in `ui/src/lib/api.ts`. No status strings are hard-coded in UI view components.

---

## 7. Migration Path: Synthetic &rarr; Real Radar

To swap from synthetic data to operational DWR telemetry:

1. **Implement Concrete Provider:** Implement `DWRRadarProvider.get_frame()` in `src/services/radar_provider.py` following the polar-to-grid normalization contract.
2. **Set Environment Variable:**
   ```bash
   export RADAR_DATA_SOURCE="dwr"
   export DWR_ENDPOINT_URL="https://dwr-archive.imd.gov.in/data/bangalore"
   ```
3. **Zero Pipeline Changes:**
   - `src/api/main.py` requires **0 modifications**.
   - `src/services/storm_tracking.py` (Phase 5) requires **0 modifications**.
   - Kinematic uncertainty circles (Phase 6) require **0 modifications**.
   - Mapbox GL JS rendering and timeline scrubbing require **0 modifications**.
