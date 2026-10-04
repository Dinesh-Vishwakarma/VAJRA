# Phase 8B-0 — Real DWR Dataset Validation

> **INTEGRITY PRINCIPLE:**  
> "Investigate and validate genuine scientific radar datasets before writing ingestion pipelines. Never treat visual graphics (GIF/PNG) as scalar radar data, never reverse-engineer colors into dBZ, and never fabricate missing metadata."

---

## 1. Dataset Location

- **Source Repository:** [`https://github.com/bamkannan/WMO_RTC-2024ShortTermCourseOnRadar`](https://github.com/bamkannan/WMO_RTC-2024ShortTermCourseOnRadar)
- **Course Context:** World Meteorological Organization (WMO) Regional Training Centre (RTC) — 2024 Short Term Course on Radar Data Analysis for Severe Weather (*"HAIL-Storms"*), presented by IMD / MoES radar meteorologists.
- **Repository Branch:** `main`
- **Access Status:** Public open-access GitHub repository; non-restricted training dataset.

---

## 2. Files Discovered

The repository tree contains 9 files across 1 subdirectory (`data/`):

| File Path | File Size | MIME / Detected Type | Meteorological Content Description |
| :--- | :--- | :--- | :--- |
| `data/2024050210404500dBZ.vol` | **206.08 KB** (211,027 B) | Binary / XML Container | **Genuine Level-II Polar Volume Scan (Rainbow Format)** containing scalar reflectivity. |
| `data/20240502_Sounding.csv` | 7.90 KB | Text / CSV | Atmospheric sounding profile (pressure, altitude, temperature, dewpoint) for thermodynamic calibration. |
| `data/Query.gif` | 765.10 KB | GIF89a Image | 8-bit rendered radar display animation loop (used for visual inspection in course). |
| `20240927ShortTermRadarRefresherCourse.ipynb` | 878.98 KB | Jupyter Notebook | Complete Python analysis workflow using Py-ART, Cartopy, and PyHail. |
| `data/150Yrs.jpeg` | 6.57 KB | JPEG Image | Course emblem graphic. |
| `data/picture1.png` | 42.39 KB | PNG Image | Course diagram graphic. |
| `data/picture2.png` | 488.05 KB | PNG Image | Course diagram graphic. |
| `README.md` | 0.34 KB | Markdown | Course syllabus summary. |
| `LICENSE` | 1.04 KB | Text | Open-source license (MIT). |

---

## 3. Radar Station

- **Station Name:** **DWR-Chennai** (`DWR Chennai Port`, IMD Station Code: `cni`)
- **Operator:** India Meteorological Department (IMD), Ministry of Earth Sciences.
- **Instrument Hardware:** S-band Doppler Weather Radar (manufactured by Bharat Electronics Limited - BEL / Gavitronics; running Leonardo-Gematronik Rainbow software).
- **Coordinates:**
  - **Latitude:** $13.0827^\circ\text{ N}$ (verified from `radar.latitude['data'][0]`)
  - **Longitude:** $80.2936^\circ\text{ E}$ (verified from `radar.longitude['data'][0]`)
  - **Antenna Altitude:** $16.0\text{ m}$ MSL ($h_0 \approx 0.016\text{ km}$)

---

## 4. File Format

- **Container Format:** **Leonardo / Gematronik Rainbow 5 (`.vol`)**
- **Internal Structure:**
  - Starts with an ASCII XML header defining scan configuration (`<volume version="5.34.53" datetime="2024-05-02T10:45:56" type="vol">`).
  - Scan identifier: `<scan name="IMD_B.vol" time="10:40:45" date="2024-05-02">`.
  - Followed by 10 compressed binary slice records storing raw polar rays (range gates $\times$ azimuth angles).
- **Polarization Mode:** `SinglePolHor` (Horizontal linear polarization).
- **Radar Scan Strategy:** `UpTo18km` (convective volume scanning up to $18\text{ km}$ altitude).

---

## 5. Variables

- **Available Scientific Variables:**
  - **`reflectivity`** (Equivalent Radar Reflectivity Factor, $Z_e$, measured in $\text{dBZ}$).
- **Pre-filtering Note:** This specific training file was pre-extracted by IMD instructors to contain only the equivalent reflectivity field (`00dBZ.vol`). Radial velocity ($V$) and spectrum width ($W$) are omitted from this specific volume file to keep the training asset compact.

---

## 6. Reflectivity Availability

- **Is Genuine Measured Reflectivity Present?** **YES.**
- The data contains un-quantized, calibrated floating-point equivalent reflectivity values ranging from $-15.0\text{ to }+65.0\text{ dBZ}$.
- It is **NOT** a rendered image, NOT an 8-bit indexed palette, and does NOT require RGB color un-mapping.

---

## 7. Temporal Characteristics

- **Observation Timestamp:** **2024-05-02 10:40:45 UTC** ($16:10:45\text{ IST}$).
- **Scan Duration:** $355\text{ seconds}$ ($\approx 5.9\text{ minutes}$ for a complete 10-elevation volume sweep).
- **Temporal Count:** **SINGLE FRAME ONLY ($T_0$).**
- **Limitation:** The repository does not include sequential temporal sweeps ($T+5, T+10, \dots$). Consequently, multi-frame playback and kinematic cell association cannot be driven solely by this single file.

---

## 8. Spatial Characteristics

- **Range Gate Resolution:** $150\text{ meters}$ (`rangestep = 0.15 km`).
- **Maximum Instrument Range:** $250.0\text{ km}$ (`stoprange = 250 km`).
- **Number of Range Bins:** $\approx 1666$ gates per ray.
- **Azimuthal Sampling:** $360$ rays per elevation sweep ($1.0^\circ$ angular step).
- **Elevation Cuts:** 10 discrete sweeps:
  $$\phi \in [0.2^\circ, 0.9^\circ, 2.0^\circ, 3.3^\circ, 4.9^\circ, 7.0^\circ, 9.6^\circ, 13.0^\circ, 17.4^\circ, 23.0^\circ]$$
- **Volume Sampling Rate:** $600\text{ Hz}$ high PRF / $450\text{ Hz}$ low PRF dual-PRF velocity de-aliasing.

---

## 9. Geographic Coverage

- **Center Location:** Chennai Port, Tamil Nadu ($80.2936^\circ\text{ E}, 13.0827^\circ\text{ N}$).
- **Radial Coverage:** $250\text{ km}$ circle extending from $77.85^\circ\text{ E}$ to $82.75^\circ\text{ E}$ and $10.8^\circ\text{ N}$ to $15.3^\circ\text{ N}$.
- **Overlap with Canonical Bengaluru Domain:**
  - Canonical Bengaluru box: $[77.3446^\circ\text{ E} - 77.8446^\circ\text{ E},\; 12.7516^\circ\text{ N} - 13.1916^\circ\text{ N}]$.
  - The $250\text{ km}$ Chennai radar sweep boundary terminates at $\approx 77.85^\circ\text{ E}$.
  - **Coverage Result:** The Chennai radar coverage terminates just east of the Bengaluru boundary (covering Kolar, Chittoor, Vellore, and Tirupati). It does **NOT cover Central or Western Bengaluru**.
  - **Beam Elevation over East Outskirts:** At $250\text{ km}$, lowest elevation beam center is $>5.5\text{ km}$ above the ground, meaning surface precipitation is partially below the radar horizon.

---

## 10. Required Processing Pipeline

To convert this raw `.vol` polar volume into a 2D Cartesian field:

```
[2024050210404500dBZ.vol]
         │
         ▼  (Py-ART / wradlib: read_rainbow_wrl)
[Polar Radar Object: 10 Sweeps x 360 Azimuths x 1666 Gates]
         │
         ▼  (Sweep Selection: lowest elevation tilt 0.2° / 0.9°)
[Single Lowest-Tilt PPI Sweep]
         │
         ▼  (pyart.map.grid_from_radars)
[Interpolation onto Cartesian Grid: e.g. 201x201 at 2 km resolution]
         │
         ▼  (Crop or Project to Domain)
[Canonical 2D float32 dBZ array]
         │
         ▼  (Quality Masking: threshold -10 to +80 dBZ, nodata = -9999.0)
[Authoritative RadarFrame]
```

---

## 11. Compatible Radar Libraries

The file `data/2024050210404500dBZ.vol` can be ingested using the following standard open-source radar toolkits:

1. **Py-ART (`arm-pyart`):**
   ```python
   import pyart
   radar = pyart.aux_io.read_rainbow_wrl('data/2024050210404500dBZ.vol')
   ```
2. **Wradlib (`wradlib`):**
   ```python
   import wradlib as wrl
   data, metadata = wrl.io.read_rainbow('data/2024050210404500dBZ.vol')
   ```
3. **Xradar (`xradar`):**
   ```python
   import xradar as xd
   dtree = xd.io.open_rainbow_datatree('data/2024050210404500dBZ.vol')
   ```

---

## 12. RadarFrame Compatibility Audit

| `RadarFrame` Field | Target Type | Value from `2024050210404500dBZ.vol` | Status |
| :--- | :--- | :--- | :--- |
| `frame_index` | `int` | $0$ (single snapshot) | **AVAILABLE** |
| `relative_time_min` | `int` | $0$ | **AVAILABLE** |
| `reflectivity_dbz` | `np.ndarray` (2D float32) | Genuine scalar array via `grid_from_radars` | **AVAILABLE** |
| `width` / `height` | `int` | Configurable (e.g. $40 \times 40$ or $201 \times 201$) | **DERIVABLE** |
| `geographic_bounds` | `List[Tuple[float, float]]` | Derivable from radar grid origin and extent | **DERIVABLE** |
| `spatial_resolution_km`| `Dict[str, float]` | Derivable from grid spacing (e.g. $dx=dy=2.0\text{ km}$) | **AVAILABLE** |
| `nodata_value` | `float` | $-9999.0$ | **AVAILABLE** |
| `valid_mask` | `np.ndarray` (2D bool) | Valid range $[-15, 75]\text{ dBZ}$ | **AVAILABLE** |
| `min_dbz` / `max_dbz` | `float` | Dynamically calculated from valid array | **AVAILABLE** |
| `source_id` | `str` | `"2024050210404500dBZ.vol"` | **AVAILABLE** |
| `source_type` | `str` | `"dwr_cband_rainbow"` / `"dwr_sband_rainbow"` | **AVAILABLE** |
| `timestamp_utc` | `str` | `"2024-05-02T10:40:45Z"` | **AVAILABLE** |

---

## 13. Problems & Blockers

1. **Temporal Sequence Blocker:**  
   The repository contains only **1 single volume scan**. A complete meteorological nowcast requires a temporal sequence (at least 3–18 frames at 5-minute intervals) to calculate storm cell centroids, velocity vectors, and nowcast trajectory cones.
2. **Geographical Extent Blocker:**  
   The dataset is from **DWR-Chennai**, centered at $80.2936^\circ\text{ E}, 13.0827^\circ\text{ N}$. It covers the Chennai–Vellore–Kolar meteorological corridor, stopping just short of central Bengaluru ($77.59^\circ\text{ E}$). Ingesting it into the exact Bengaluru bounding box would yield clear-air/no-data on the western half unless the domain center is adjusted to the radar's active coverage sector.
3. **Heavy Dependency Footprint:**  
   `pyart` and `cartopy` require compiled C/Fortran libraries (`GDAL`, `PROJ`, `GEOS`), which may complicate lightweight deployment environments unless managed through Conda or precompiled wheels.

---

## 14. Recommendation for Phase 8B Implementation

1. **Dataset Verdict: `PARTIALLY_USABLE`**
   - **Usable For:** Prototyping a real Level-II radar reader (`RainbowVolumeReader`) that loads genuine scalar floating-point reflectivity into a valid `RadarFrame`.
   - **Not Usable For:** Full 18-frame timeline playback, storm cell motion tracking, or kinematic uncertainty nowcasting without temporal frames.
2. **Recommended Action:**
   - Use `data/2024050210404500dBZ.vol` as an offline unit-test fixture to validate the Level-II ingestion engine.
   - For Phase 8B multi-frame ingestion, obtain a multi-timestamp sequence (3–18 consecutive sweeps) from IMD NDC or an open multi-scan benchmark, or build a multi-station adapter.
