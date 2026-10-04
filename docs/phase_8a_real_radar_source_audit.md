# Phase 8A — Real Radar Source Audit

> **CRITICAL ARCHITECTURAL INTEGRITY RULE:**  
> **"Public radar imagery is available, but this does not provide a validated scalar reflectivity data source for VAJRA storm-cell analytics."**  
> Rendering formats such as GIF and PNG are derived visual display products and are never the authoritative radar data source.

---

## 1. Sources Investigated

During this investigation/prototyping phase, only official **India Meteorological Department (IMD)** and **Ministry of Earth Sciences (MoES)** infrastructure, portals, and data dissemination channels were investigated:

1. **IMD National Weather Portal (Mausam):** [`https://mausam.imd.gov.in/`](https://mausam.imd.gov.in/)
   - Dedicated Radar Network Portal: [`https://mausam.imd.gov.in/responsive/radar.php`](https://mausam.imd.gov.in/responsive/radar.php)
   - Radar Animation Service: [`https://mausam.imd.gov.in/responsive/radar_animation.php`](https://mausam.imd.gov.in/responsive/radar_animation.php)
   - National Radar Composite Mosaic: [`https://mausam.imd.gov.in/Radar/MOSAIC/Converted/mosaic.gif`](https://mausam.imd.gov.in/Radar/MOSAIC/Converted/mosaic.gif)
2. **IMD Regional Meteorological Centre (RMC) Chennai & Met Centre Bengaluru:**
   - Bengaluru Meteorological Centre: [`https://metbengaluru.imd.gov.in/`](https://metbengaluru.imd.gov.in/)
   - Urban Meteorological Services for Bengaluru: [`https://mausam.imd.gov.in/bengaluru/`](https://mausam.imd.gov.in/bengaluru/)
3. **IMD National Data Centre (NDC) Pune / Data Supply Portal:**
   - Data Supply Portal (DSP): [`https://dsp.imdpune.gov.in/`](https://dsp.imdpune.gov.in/)
   - Meteorological Data Dissemination Portal: [`https://imdpune.gov.in/`](https://imdpune.gov.in/)
4. **Radar Division, IMD HQ New Delhi:**
   - Operational Radar Network & Specifications documentation: Dr. Soma Sen Roy (Scientist 'G', Head Radar Division, Mausam Bhawan).

---

## 2. Official IMD Endpoints

The non-destructive probe script [`scratch/probe_imd_radar.py`](file:///c:/Users/yoges/OneDrive/Desktop/SIH/Vajra%20project2/Code%20repo/VAJRA/scratch/probe_imd_radar.py) probed documented public endpoints with standard HTTP `GET` requests and 12-second timeouts:

| Endpoint Identifier | Target URL | HTTP Method | Auth Required | HTTP Status | Response Content-Type | Size / Sample | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `imd_mausam_radar_home` | `https://mausam.imd.gov.in/responsive/radar.php` | `GET` | None | `200 OK` | `text/html; charset=UTF-8` | ~46 KB HTML | `RADAR_IMAGE_ONLY` |
| `imd_national_radar_mosaic`| `https://mausam.imd.gov.in/Radar/MOSAIC/Converted/mosaic.gif` | `GET` | None | `200 OK` | `image/gif` | 12.2 MB GIF | `RADAR_IMAGE_ONLY` |
| `imd_dwr_chennai_caz` | `https://mausam.imd.gov.in/Radar/caz_cni.gif` | `GET` | None | `200 OK` | `image/gif` | 282.8 KB GIF | `RADAR_IMAGE_ONLY` |
| `imd_dwr_chennai_ppz` | `https://mausam.imd.gov.in/Radar/ppz_cni.gif` | `GET` | None | `200 OK` | `image/gif` | 275.4 KB GIF | `RADAR_IMAGE_ONLY` |
| `imd_dwr_kochi_caz` | `https://mausam.imd.gov.in/Radar/caz_koc.gif` | `GET` | None | `200 OK` | `image/gif` | 127.4 KB GIF | `RADAR_IMAGE_ONLY` |
| `imd_data_supply_pune` | `https://dsp.imdpune.gov.in/` | `GET` | Yes (Portal) | `200 OK` | `text/html; charset=UTF-8` | Portal HTML | `RADAR_IMAGE_ONLY` |
| `imd_nowcast_api_test` | `https://mausam.imd.gov.in/api/nowcast_district.php` | `GET` | N/A | `404 Not Found` | N/A | 0 bytes | `UNKNOWN` |

### Key Endpoint Observations
- **Timestamp Behavior:** Timestamps are burned as pixel text directly into the header/footer banner of the GIF raster images (e.g., `CHENNAI MAX_Z 2026-10-04 07:30 UTC`). There is **no machine-readable JSON metadata header** accompanying the GIF.
- **Update Frequency:** Radar sweeps update every 10–15 minutes on the portal during active weather, but scan delivery can be delayed or suspended during radar transmitter calibration or maintenance.
- **Historical Frames:** Historical radar frames are not served through an open REST API archive. The public portal only provides 3-hour or 24-hour GIF animation loops on `radar_animation.php`.

---

## 3. Bengaluru-Relevant Radar Coverage

### Critical Finding: Bengaluru Has No In-Situ Operational DWR
A detailed audit of IMD operational infrastructure reveals a significant geographical limitation:
- **Bengaluru does NOT currently possess an active, dedicated Doppler Weather Radar (DWR).**
- Formal proposals to commission a C-band DWR for Bengaluru urban have been planned, but installation was deferred by IMD (with Karnataka's first recent DWR priority directed toward coastal Mangaluru).
- Kempegowda International Airport (KIA) operates wind profiler radar, runway visual range (RVR), and ceilometer sensors, but **not an open-horizon volume-scanning meteorological DWR**.

### Surrounding Radar Coverage & Physical Geometry
Bengaluru relies on peripheral coverage from distant regional coastal radars:

1. **Chennai Port DWR (`cni`):**
   - **Radar Type:** S-band Doppler Weather Radar (Gavitronics/BEL, 2.7–2.9 GHz, $\lambda \approx 10\text{ cm}$)
   - **Distance to Bengaluru:** $\approx 290\text{ km}$ West.
   - **Physical Beam Elevation:** At a standard minimum antenna tilt of $0.5^\circ$ and accounting for atmospheric refraction ($4/3$ earth radius model), the radar beam center over Bengaluru is at an altitude of:
     $$h \approx r \sin(\theta) + \frac{r^2}{2 k R_e} \approx 290 \cdot \sin(0.5^\circ) + \frac{290^2}{2 \cdot 1.333 \cdot 6371} \approx 2.53\text{ km} + 4.95\text{ km} \approx 7.48\text{ km}\text{ MSL}$$
   - Given Bengaluru's surface elevation of $\approx 920\text{ m}$, the beam passes **$6.5\text{ km}$ above the ground**! Consequently, Chennai DWR cannot detect low-level boundary layer moisture convergence, shallow convective cells, or localized cloudburst initiation over Bengaluru. It only samples storm anvil tops and deep convective towers $>7\text{ km}$.
2. **Sriharikota DWR (SHAR, ISRO):**
   - **Distance:** $\approx 310\text{ km}$ ENE. Similar physical beam-overshooting limitations.
3. **Kochi DWR (`koc`):**
   - **Distance:** $\approx 360\text{ km}$ SW. Severe Western Ghats mountain beam blockage (orographic beam shadowing).

### Current Public Coverage Over Bengaluru
The only publicly accessible representation covering the Bengaluru domain (`77.3446°E–77.8446°E`, `12.7516°N–13.1916°N`) is the **National/Regional Composite Radar Mosaic** (`MOSAIC/Converted/mosaic.gif`), which composites multi-radar MAX-Z with significant spatial interpolation and smoothing.

---

## 4. Public Accessibility

- **Radar Visual Images (GIF/PNG):** **ACCESSIBLE (`true`)**
  - Publicly accessible via HTTP `GET` without authentication.
- **Raw Scientific Data Arrays (NetCDF/HDF5/BUFR):** **INACCESSIBLE via Public API (`false`)**
  - There is **no publicly accessible unauthenticated API or S3 bucket** hosting raw IMD radar volume data.

---

## 5. Response Formats

The publicly accessible IMD radar endpoints return:
- **Format:** Compuserve GIF89a / GIF87a graphic files.
- **Dimensions:** 
  - National Mosaic: Variable ($800 \times 600$ to $1200 \times 1000$).
  - Station MAX-Z (`caz_cni.gif`): $919 \times 700$ pixels.
- **Color Depth:** 8-bit indexed palette (256 colors).
- **Embedded Elements:** Coastlines, state borders, national borders, concentric range rings ($100\text{ km}$, $250\text{ km}$), station text, and a visual color bar legend are permanently rasterized into the pixel array.
- **Scientific Classification:** **`RADAR_IMAGE_ONLY`**.

---

## 6. Scientific-Data Availability (NetCDF, HDF5, BUFR)

Official IMD documentation and scientific publications (e.g. *PyScanCf*, *IMD Radar Division SOPs*) confirm that internal IMD radar systems record scientific volume scans in:
1. **IRIS / RAW (Vaisala Sigmet):** Used by Vaisala C-band and S-band installations.
2. **Rainbow (Leonardo / Selex):** Used by Selex METEOR 1500C/1600S radars.
3. **CfRadial / NetCDF4:** Standardized by IMD research groups using *PyScanCf*.
4. **HDF5 (ODIM_H5):** Operational Data Information Model for weather radar.

### Access Mechanism for Scientific Formats
- **Public Open Access:** **NONE.**
- **Authorized Acquisition Route:** Requires formal requisition through the **IMD Pune National Data Centre (NDC)** via the Data Supply Portal (`https://dsp.imdpune.gov.in/`).
- **Requirements:**
  1. User account registration with institutional/organizational credentials.
  2. Submission of a formal Data Requisition Form specifying station (`CHENNAI`, `SRIHARIKOTA`, etc.), parameter (`dBZ`, `ZDR`, `KDP`, `V`), temporal window, and intended purpose.
  3. Administrative security review and approval by the Additional Director General of Meteorology (Research), IMD Pune.
  4. Payment of applicable government tariffs/fees (except for accredited academic/defence research exemptions).
  5. Manual or FTP delivery of archived HDF5/NetCDF files.

---

## 7. RadarFrame Compatibility Audit

Comparison of the publicly available IMD radar source against the canonical VAJRA `RadarFrame` schema:

| `RadarFrame` Field | Expected Canonical Type | Public IMD Status | Classification | Detailed Compatibility Assessment |
| :--- | :--- | :--- | :--- | :--- |
| `frame_index` | `int` (0 to 17) | Missing | **NOT_AVAILABLE** | No discrete index; only animated GIF loops or static current images. |
| `relative_time_min`| `int` (0 to 85 min) | Missing | **DERIVABLE** | Can be approximated if timestamps are parsed from successive image downloads. |
| `reflectivity_dbz` | `np.ndarray` (2D float32) | Missing | **NOT_AVAILABLE** | Only 8-bit visual palette indices. True scalar dBZ values are not provided. Reverse-engineering RGB into dBZ is lossy and violates Phase 7 rules. |
| `width` | `int` (40 cells) | $919\text{ px}$ (Station) | **NOT_AVAILABLE** | Arbitrary visual image dimensions containing map borders and legends. |
| `height` | `int` (40 cells) | $700\text{ px}$ (Station) | **NOT_AVAILABLE** | Non-Cartesian visual aspect ratio. |
| `geographic_bounds`| `List[Tuple[float, float]]` | Unreferenced | **NOT_AVAILABLE** | No GeoTIFF world file, GeoTransform tag, or CRS metadata is included with the GIF. |
| `spatial_resolution`| `Dict[str, float]` | Unspecified | **NOT_AVAILABLE** | Pixel spacing varies with map projection and cannot be calibrated without ground truth control points. |
| `nodata_value` | `float` (-9999.0) | Ambiguous | **NOT_AVAILABLE** | Background black (`#000000`) and clear-air echoes are confounded with border elements. |
| `valid_mask` | `np.ndarray` (2D bool) | Missing | **NOT_AVAILABLE** | Text annotations, state borders, and range rings overlap echo pixels, preventing automated masking. |
| `min_dbz` | `float` | Missing | **NOT_AVAILABLE** | Not provided in metadata. |
| `max_dbz` | `float` | Missing | **NOT_AVAILABLE** | Not provided in metadata. |
| `source_id` | `str` | Available | **AVAILABLE** | e.g. `caz_cni.gif` or `mosaic.gif`. |
| `source_type` | `str` | Available | **AVAILABLE** | `imd_gif_image`. |
| `timestamp_utc` | `Optional[str]` (ISO 8601) | Burned into image | **DERIVABLE** | Text string in image banner (e.g. `2026-10-04 07:30 UTC`) can be extracted with OCR/regex. |

---

## 8. Authentication & Access Requirements Summary

1. **Public Web Imagery:**
   - **Authentication:** None required.
   - **Allowed Use:** Human browser inspection.
   - **Suitability for VAJRA:** Unsuitable for storm cell detection, DBSCAN clustering, or nowcast velocity calculations.
2. **Official Scientific Telemetry (NDC IMD Pune):**
   - **Authentication:** Mandatory login and approved data clearance via `https://dsp.imdpune.gov.in/`.
   - **Format:** HDF5 / NetCDF / CfRadial.
   - **Suitability for VAJRA:** Highly suitable once ingested and normalized into canonical `RadarFrame`.

---

## 9. Recommended Integration Path for Phase 8B

1. **Maintain Synthetic Baseline:** Keep `SyntheticRadarProvider` as the primary operational provider for continuous 5-minute nowcasting demonstrations.
2. **Do NOT Scrape or Reverse-Color Public GIFs:** Refrain from converting IMD GIF/PNG pixels to pseudo-dBZ. Such data cannot sustain Phase 5 storm tracking or Phase 6 uncertainty mathematics.
3. **Formal NDC Ingestion Pipeline (Phase 8B Prototype):**
   - Acquire a sample historical volume scan (HDF5 / NetCDF) from the IMD National Data Centre (NDC Pune) or open scientific benchmark repositories (such as the *PyScanCf* sample dataset for C-band/S-band Indian radars).
   - Build a verified `IMDScientificNetCDFProvider` implementing `RadarDataProvider` that reads genuine floating-point radar arrays, grids them onto the canonical Bengaluru bbox, and computes authoritative `RadarFrame` instances.
4. **Display Distinction:** If public IMD composite imagery is displayed in the UI, treat it strictly as an optional **visual backdrop raster layer** (analogous to satellite IR), distinct from the analytical radar field that drives cell detection and hazard warnings.

---

## 10. What Remains Unavailable

1. **In-situ Bengaluru Radar Core:** No Doppler Weather Radar exists directly inside Bengaluru Urban. Any real-data integration must accept the physical limitations of distant coastal radar beams ($>6.5\text{ km}$ above Bengaluru terrain) or regional composite mosaics.
2. **Real-time Public Scientific API:** IMD does not provide an open, free, unauthenticated REST API streaming raw NetCDF or HDF5 radar arrays in real time.
3. **High-frequency Observation Feeds:** Real-time 5-minute automated ingest requires either an authorized institutional link to IMD GTS/Mausam Bhawan or an on-site X-band compact radar installation.
