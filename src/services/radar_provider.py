"""
VAJRA Phase 7: Canonical Radar Data Abstraction Layer.
Defines canonical RadarFrame representations, data provider interfaces,
data quality/nodata handling, and provider factories.

ARCHITECTURAL PRINCIPLE:
"Radar processing operates on canonical scalar reflectivity data.
Rendering formats such as PNG are derived products and are never
the authoritative radar data source."
"""

import os
import abc
import threading
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Tuple
import numpy as np

# Canonical Bengaluru Radar Extent (WGS84)
CANONICAL_BOUNDS: List[Tuple[float, float]] = [
    (77.3446, 13.1916), # Northwest [lon, lat]
    (77.8446, 13.1916), # Northeast
    (77.8446, 12.7516), # Southeast
    (77.3446, 12.7516), # Southwest
]

BOUNDS_NW = (77.3446, 13.1916)
BOUNDS_SE = (77.8446, 12.7516)
DEFAULT_GRID_H = 40
DEFAULT_GRID_W = 40
DEFAULT_FRAME_INTERVAL_MIN = 5
NODATA_VALUE_DEFAULT = -9999.0

# Spatial physical resolution around 13°N: 54.34 km lon, 48.68 km lat
KM_PER_DEG_LAT = 110.574
KM_PER_DEG_LON = 108.48
DEFAULT_DX_KM = (0.5000 / DEFAULT_GRID_W) * KM_PER_DEG_LON # ~1.3585 km
DEFAULT_DY_KM = (0.4400 / DEFAULT_GRID_H) * KM_PER_DEG_LAT # ~1.2170 km

@dataclass
class RadarFrame:
    """
    Authoritative canonical internal representation of a 2D scalar radar reflectivity field.
    All downstream algorithms (cell segmentation, tracking, nowcasting, and rendering)
    consume this canonical model rather than raw files or display raster PNGs.
    """
    frame_index: int
    relative_time_min: int
    reflectivity_dbz: np.ndarray # 2D float32 scalar array (H, W) in dBZ
    width: int
    height: int
    geographic_bounds: List[Tuple[float, float]] # 4 corners [NW, NE, SE, SW] in [lon, lat]
    spatial_resolution_km: Dict[str, float] # {'dx': float, 'dy': float}
    nodata_value: float # e.g. -9999.0
    valid_mask: np.ndarray # 2D boolean mask: True where reflectivity is valid meteorologically
    min_dbz: float
    max_dbz: float
    source_id: str
    source_type: str # 'synthetic' | 'dwr_cband' | 'imd_maxz'
    synthetic_demo: bool = True
    timestamp_utc: Optional[str] = None

    def get_valid_reflectivity(self) -> np.ndarray:
        """Returns reflectivity array with nodata values masked or replaced with 0 for thresholding."""
        cleaned = self.reflectivity_dbz.copy()
        cleaned[~self.valid_mask] = 0.0
        return cleaned


def validate_reflectivity_field(
    data: np.ndarray,
    nodata_val: float = NODATA_VALUE_DEFAULT
) -> Tuple[np.ndarray, np.ndarray, float, float]:
    """
    Inspects scalar reflectivity array for quality, missing data, NaNs, and physical bounds.
    Returns: (cleaned_array, valid_mask, min_valid_dbz, max_valid_dbz).
    Meteorologically plausible Doppler equivalent reflectivity typically spans -20 to 80 dBZ.
    """
    arr = data.astype(np.float32)
    # Detect non-finite numbers (NaN, Inf) and sentinel values
    nan_mask = np.isnan(arr) | np.isinf(arr) | (arr <= -900.0)
    
    # Meteorologically plausible range for precipitation echoes
    out_of_bounds = (arr < -30.0) | (arr > 95.0)
    invalid_mask = nan_mask | out_of_bounds
    valid_mask = ~invalid_mask

    cleaned_arr = arr.copy()
    cleaned_arr[invalid_mask] = nodata_val

    if np.any(valid_mask):
        min_dbz = float(np.min(cleaned_arr[valid_mask]))
        max_dbz = float(np.max(cleaned_arr[valid_mask]))
    else:
        min_dbz = 0.0
        max_dbz = 0.0

    return cleaned_arr, valid_mask, min_dbz, max_dbz


class RadarDataProvider(abc.ABC):
    """
    Abstract interface for meteorological radar data providers.
    Decouples raw telemetry ingestion (files, DWR radial sweeps, IMD grids)
    from downstream consumers (PNG rendering, storm cell detection, tracking).
    """

    @abc.abstractmethod
    def get_frame(self, frame_index: int) -> RadarFrame:
        """Retrieve authoritative canonical RadarFrame for a given temporal index."""
        pass

    @abc.abstractmethod
    def get_available_frames(self) -> List[int]:
        """List all valid temporal frame indices currently available."""
        pass

    @abc.abstractmethod
    def get_metadata(self) -> Dict[str, Any]:
        """Return standardized descriptive metadata, grid geometry, and source disclosure."""
        pass

    @abc.abstractmethod
    def get_frame_count(self) -> int:
        """Return total count of available frames."""
        pass


class SyntheticRadarProvider(RadarDataProvider):
    """
    Concrete provider implementation wrapping the baseline procedural radar forecast dataset.
    Reads 'data/processed/latest_forecast.npy' and yields canonical RadarFrames.
    Preserves existing 18 frames, 40x40 dimensions, and numerical dBZ values with zero alteration.
    """

    def __init__(self, forecast_path: Optional[str] = None):
        self._lock = threading.Lock()
        if forecast_path is None:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
            forecast_path = os.path.join(base_dir, 'data', 'processed', 'latest_forecast.npy')
        self._forecast_path = forecast_path
        self._raw_data: Optional[np.ndarray] = None
        self._frames_cache: Dict[int, RadarFrame] = {}

    def _ensure_loaded(self):
        """Lazy thread-safe loading of the forecast volume."""
        if self._raw_data is None:
            with self._lock:
                if self._raw_data is None:
                    if not os.path.exists(self._forecast_path):
                        # Trigger existing sample generator if array is missing
                        from src.api.main import init_sample_forecast_if_missing
                        init_sample_forecast_if_missing()
                        
                    data = np.load(self._forecast_path).astype(np.float32)
                    if data.ndim != 3:
                        raise ValueError(f"Expected 3D radar forecast array (T, H, W), got shape {data.shape}")
                    self._raw_data = data

    def get_frame_count(self) -> int:
        self._ensure_loaded()
        return self._raw_data.shape[0]

    def get_available_frames(self) -> List[int]:
        count = self.get_frame_count()
        return list(range(count))

    def get_frame(self, frame_index: int) -> RadarFrame:
        self._ensure_loaded()
        total_frames = self._raw_data.shape[0]
        
        if frame_index < 0 or frame_index >= total_frames:
            raise IndexError(f"Frame index {frame_index} out of range (0 to {total_frames - 1})")

        if frame_index in self._frames_cache:
            return self._frames_cache[frame_index]

        raw_slice = self._raw_data[frame_index]
        h, w = raw_slice.shape
        cleaned_arr, valid_mask, min_dbz, max_dbz = validate_reflectivity_field(raw_slice)
        relative_min = frame_index * DEFAULT_FRAME_INTERVAL_MIN

        frame = RadarFrame(
            frame_index=frame_index,
            relative_time_min=relative_min,
            reflectivity_dbz=cleaned_arr,
            width=w,
            height=h,
            geographic_bounds=CANONICAL_BOUNDS,
            spatial_resolution_km={'dx': DEFAULT_DX_KM, 'dy': DEFAULT_DY_KM},
            nodata_value=NODATA_VALUE_DEFAULT,
            valid_mask=valid_mask,
            min_dbz=min_dbz,
            max_dbz=max_dbz,
            source_id="latest_forecast.npy",
            source_type="synthetic",
            synthetic_demo=True,
            timestamp_utc=None
        )

        with self._lock:
            self._frames_cache[frame_index] = frame

        return frame

    def get_metadata(self) -> Dict[str, Any]:
        self._ensure_loaded()
        count = self._raw_data.shape[0]
        h, w = self._raw_data.shape[1], self._raw_data.shape[2]

        return {
            "source_type": "synthetic",
            "source_id": "latest_forecast.npy",
            "provider_class": "SyntheticRadarProvider",
            "synthetic_demo": True,
            "status_disclosure": "SYNTHETIC DATA — DEMO ONLY",
            "disclaimer": "Synthetic procedural Gaussian advection model. Not real observational radar.",
            "frame_count": count,
            "interval_minutes": DEFAULT_FRAME_INTERVAL_MIN,
            "temporal_range": {
                "start_offset_min": 0,
                "end_offset_min": (count - 1) * DEFAULT_FRAME_INTERVAL_MIN
            },
            "grid": {
                "width": w,
                "height": h
            },
            "units": "dBZ",
            "valid_range": {
                "min_dbz": 0.0,
                "max_dbz": float(np.max(self._raw_data))
            },
            "nodata_value": NODATA_VALUE_DEFAULT,
            "bounds": CANONICAL_BOUNDS,
            "spatial_resolution_km": {
                "dx": round(DEFAULT_DX_KM, 4),
                "dy": round(DEFAULT_DY_KM, 4)
            }
        }


# =============================================================================
# EXTENSION POINTS FOR FUTURE OBSERVATIONAL RADAR INGESTION
# =============================================================================

class DWRRadarProvider(RadarDataProvider):
    """
    FUTURE EXTENSION POINT: Direct Doppler Weather Radar (DWR) Provider.
    
    When connecting to real DWR hardware or archive streams (e.g. IMD DWR Bangalore C-band),
    a concrete implementation must normalize the following physical characteristics
    into the canonical RadarFrame:
    
    1. Coordinate System: Transform raw spherical polar coordinates (range r, azimuth theta, elevation phi)
       via radar geometric projection (e.g. Py-ART or wradlib) onto the canonical WGS84 Cartesian grid.
    2. Sweep Normalization: Ingest multi-tilt Plan Position Indicator (PPI) volume scans and compute
       Constant Altitude PPI (CAPPI) or Maximum Reflectivity Composite (MAX-Z).
    3. Clutter Mitigation: Filter anomalous propagation (AP), ground clutter, and electromagnetic interference.
    4. Attenuation Correction: Apply path attenuation correction for C-band/X-band frequencies using dual-pol Kdp.
    5. Nodata Masking: Distinguish true clear-air echoes (<10 dBZ) from blocked radials or out-of-range beam cones.
    6. Temporal Spacing: Resample uneven antenna sweep intervals into uniform intervals.
    """

    def __init__(self, endpoint_url: str):
        self.endpoint_url = endpoint_url
        raise NotImplementedError(
            "DWRRadarProvider is a future architectural extension point. "
            "Real hardware connection is not yet configured for Phase 7. "
            "Use 'SyntheticRadarProvider' for current pipeline execution."
        )

    def get_frame(self, frame_index: int) -> RadarFrame:
        raise NotImplementedError("DWRRadarProvider is not yet implemented.")

    def get_available_frames(self) -> List[int]:
        raise NotImplementedError("DWRRadarProvider is not yet implemented.")

    def get_metadata(self) -> Dict[str, Any]:
        raise NotImplementedError("DWRRadarProvider is not yet implemented.")

    def get_frame_count(self) -> int:
        raise NotImplementedError("DWRRadarProvider is not yet implemented.")


class IMDRadarProvider(RadarDataProvider):
    """
    FUTURE EXTENSION POINT: India Meteorological Department (IMD) Gridded Radar Provider.
    
    When connecting to IMD National Radar Composite or Open Data portals:
    1. Ingestion: Ingest HDF5 / NetCDF4 / GeoTIFF gridded mosaics.
    2. Spatial Cropping: Extract the 40x40 regional sub-grid covering the canonical Bengaluru domain.
    3. Calibration Offsets: Align IMD raw numerical counts to physical equivalent reflectivity factor (dBZ).
    4. Missing Scans: Handle latency, missed radar scans, and network timeouts gracefully.
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        raise NotImplementedError(
            "IMDRadarProvider is a future architectural extension point. "
            "IMD radar ingestion is not yet configured for Phase 7. "
            "Use 'SyntheticRadarProvider' for current pipeline execution."
        )

    def get_frame(self, frame_index: int) -> RadarFrame:
        raise NotImplementedError("IMDRadarProvider is not yet implemented.")

    def get_available_frames(self) -> List[int]:
        raise NotImplementedError("IMDRadarProvider is not yet implemented.")

    def get_metadata(self) -> Dict[str, Any]:
        raise NotImplementedError("IMDRadarProvider is not yet implemented.")

    def get_frame_count(self) -> int:
        raise NotImplementedError("IMDRadarProvider is not yet implemented.")


# =============================================================================
# PROVIDER FACTORY & SINGLETON MANAGEMENT
# =============================================================================

_active_provider: Optional[RadarDataProvider] = None
_provider_lock = threading.Lock()

def get_radar_provider() -> RadarDataProvider:
    """
    Factory resolving the active RadarDataProvider according to system configuration.
    Controlled via environment variable: RADAR_DATA_SOURCE (default: 'synthetic').
    Supported in Phase 7: 'synthetic'.
    """
    global _active_provider
    if _active_provider is None:
        with _provider_lock:
            if _active_provider is None:
                source = os.getenv("RADAR_DATA_SOURCE", "synthetic").strip().lower()
                
                if source == "synthetic":
                    _active_provider = SyntheticRadarProvider()
                elif source in ("imd_sample", "real_sample"):
                    from src.services.rainbow_volume_reader import IMDScientificRadarProvider
                    _active_provider = IMDScientificRadarProvider()
                elif source in ("imd_goa_netcdf", "imd_multiframe", "real_multiframe"):
                    from src.services.imd_netcdf_reader import IMDNetCDFRadarProvider
                    _active_provider = IMDNetCDFRadarProvider()
                elif source in ("dwr", "live_dwr"):
                    raise NotImplementedError("DWRRadarProvider is an extension point for future phases.")
                elif source in ("imd", "live_imd"):
                    raise NotImplementedError("IMDRadarProvider is an extension point for future phases.")

                else:
                    print(f"[RadarProvider] Unknown RADAR_DATA_SOURCE='{source}', falling back to 'synthetic'")
                    _active_provider = SyntheticRadarProvider()
                    
    return _active_provider



def reset_radar_provider_for_testing(provider: Optional[RadarDataProvider] = None):
    """Testing helper to reset or inject a mock provider."""
    global _active_provider
    with _provider_lock:
        _active_provider = provider
