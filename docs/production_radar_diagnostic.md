# VAJRA Production Radar Deployment & Diagnostic Audit

**Date:** 2026-10-04  
**Status:** Root Cause Identified  
**Audit Scope:** Production Network, CORS, Data Availability, Mapbox Layer Rendering Pipeline

---

## 1. Executive Summary

The radar reflectivity raster overlay appears correctly on **localhost** (after the Phase 8B-3 `VajraMap.tsx` fix), but remains **invisible on the deployed production site** (`https://vajra-qpqb.vercel.app`).

An exhaustive production-path audit was conducted across the live Vercel frontend, the live Railway backend, HTTP headers, CORS policies, compiled JavaScript bundles, and Mapbox layer composition.

### Key Finding
- **Backend Health:** The production backend on Railway is **100% operational**. It serves genuine radar metadata, valid PNGs across all 18 frames, has `latest_forecast.npy` loaded, and permits CORS from any origin (`*`).
- **Network / Transport:** There are **zero network, DNS, 404/500, mixed content, or CORS errors**.
- **Root Cause:** The deployed production build on Vercel is running **stale compiled code (commit `7db0ae0`)**. Inspection of the live production JS bundle (`24-wv4x_04a5t.js`) confirmed that the deployed site still specifies `slot: "middle"`. In Mapbox Standard Style, `slot: 'middle'` causes the radar raster layer to be occluded beneath opaque basemap polygon fills and 3D buildings. Furthermore, the local fix (which changed `slot` to `'top'` and synchronized `timeIdx` to `radarSource.updateImage`) was kept in local uncommitted/unpushed state.

---

## 2. Production URL & Environment Architecture

### 2.1 Endpoints
| Component | Hosting Platform | URL | Operational Status |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | `https://vajra-qpqb.vercel.app` | HTTP 200 (Active) |
| **Backend** | Railway | `https://vajra-production-aad1.up.railway.app` | HTTP 200 (Active) |

### 2.2 Client-Side URL Construction
In `ui/src/lib/api.ts` and `ui/src/app/page.tsx`:
```typescript
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      const pub = (process.env.NEXT_PUBLIC_API_URL || '').trim();
      if (pub && !pub.includes('localhost') && !pub.includes('127.0.0.1')) {
        return pub.replace(/\/+$/, '');
      }
      return 'https://vajra-production-aad1.up.railway.app';
    }
  }
  ...
}
```
In the deployed production bundle (`12uu-mxkw82j9.js` and `24-wv4x_04a5t.js`), `getApiBaseUrl()` compiles to `https://vajra-production-aad1.up.railway.app`.

---

## 3. Production Backend Endpoint Validation

Each required production endpoint was directly audited with `Origin: https://vajra-qpqb.vercel.app`:

| Endpoint | HTTP Status | Content-Type | Response Size | Valid PNG? | CORS Header |
| :--- | :---: | :--- | :---: | :---: | :--- |
| `/` | **200 OK** | `application/json` | 262 B | N/A | `*` |
| `/api/radar/metadata` | **200 OK** | `application/json` | 612 B | N/A | `*` |
| `/api/radar/frame/0` | **200 OK** | `image/png` | 2,552 B | **YES** (`\x89PNG\r\n\x1a\n`) | `*` |
| `/api/radar/frame/4` | **200 OK** | `image/png` | 2,909 B | **YES** (`\x89PNG\r\n\x1a\n`) | `*` |
| `/api/radar/frame/10` | **200 OK** | `image/png` | 3,831 B | **YES** (`\x89PNG\r\n\x1a\n`) | `*` |
| `/api/radar/frame/17` | **200 OK** | `image/png` | 4,588 B | **YES** (`\x89PNG\r\n\x1a\n`) | `*` |
| `/api/radar/cells/0` | **200 OK** | `application/json` | 91 B | N/A | `*` |
| `/api/radar/cells/4` | **200 OK** | `application/json` | 5,731 B | N/A | `*` |

---

## 4. CORS Policy Audit

### Configuration
In `src/api/main.py`:
```python
allowed_origins_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app" if "*" not in allowed_origins else None,
    allow_credentials=True if "*" not in allowed_origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Verification
- **GET Request:** Returns `access-control-allow-origin: *`.
- **OPTIONS Preflight:**
  - Status: `HTTP 200 OK`
  - `access-control-allow-origin: *`
  - `access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT, QUERY`
  - `access-control-allow-headers: content-type`
- **Result:** CORS does **NOT** block radar image acquisition on Vercel.

---

## 5. Production Forecast Array (`latest_forecast.npy`) Verification

Querying `/api/radar/metadata` on Railway returns:
```json
{
  "source_type": "synthetic",
  "source_id": "latest_forecast.npy",
  "provider_class": "SyntheticRadarProvider",
  "synthetic_demo": true,
  "frame_count": 18,
  "interval_minutes": 5,
  "grid": { "width": 40, "height": 40 },
  "valid_range": { "min_dbz": 0.0, "max_dbz": 65.0 }
}
```
`main.py` auto-generates `latest_forecast.npy` via `init_sample_forecast_if_missing()` on container boot.
- **Result:** `latest_forecast.npy` **exists and is actively serving in production**.

---

## 6. Production Bundle Inspection & Comparison

Direct reverse-engineering of the active JavaScript bundle on `https://vajra-qpqb.vercel.app/_next/static/immutable/chunks/24-wv4x_04a5t.js`:

| Parameter | Localhost (Fixed in Part 1) | Production Vercel (Live) |
| :--- | :--- | :--- |
| **Commit Deployed** | Working Tree (Pending Push) | `7db0ae0` (Stale) |
| **Mapbox Standard Slot** | `slot: 'top'` (Renders above basemap & buildings) | `slot: 'middle'` (Covered by basemap) |
| **Initial Source URL** | `getRadarFrameUrl(timeIdx)` | `getRadarFrameUrl(0)` |
| **Timeline Reactive Update** | `radarSource.updateImage({ url })` on `timeIdx` | Missing in `VajraMap.tsx` |
| **Visibility Property** | Visible (`raster-opacity: 0.85`) | Hidden behind basemap fills |

---

## 7. Diagnostic Classification

**Primary Classification:** `G. Mapbox/rendering issue` (specifically: **Undeployed Slot Occlusion Bug in Production**).

### Root Cause Details:
1. Mapbox Standard Style (`mapbox://styles/mapbox/standard`) treats `slot: 'middle'` as a ground surface drape layer underneath the basemap's landuse fills and 3D buildings.
2. In the deployed production bundle, the radar layer is inserted with `slot: 'middle'`. The colored pixels are rendered into the WebGL frame buffer, but are immediately painted over by the basemap polygons.
3. The local fix (`slot: 'top'` in `ui/src/components/map/VajraMap.tsx`) and the reactive `timeIdx` effect were never committed or pushed to the repository, leaving the production deployment on the obsolete commit `7db0ae0`.

---

## 8. Recommended Minimal Fix

1. Review and stage the local fix in `ui/src/components/map/VajraMap.tsx` (`slot: 'top'` and the `timeIdx` image update hook).
2. Commit the changes to `main`.
3. Push to `origin/main` to trigger the automated Vercel CI/CD build.
4. Verify the new Vercel deployment renders the radar reflectivity raster over Bengaluru on `https://vajra-qpqb.vercel.app`.
