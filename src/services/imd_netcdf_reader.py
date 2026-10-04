"""
VAJRA Phase 8B-2: Real Multi-Frame IMD DWR NetCDF Reader & Provider.
Consumes genuine Level-II observational NetCDF-3 radar scans from IMD Goa DWR
and converts them into canonical RadarFrames for multi-frame playback,
storm cell detection, tracking, and uncertainty evaluation.

DATASET PROVENANCE:
- Source: syedhamidali/pyscancf_examples (OpenRadar community)
- Station: IMD Goa DWR (C-band, Lat: 15.4833°N, Lon: 73.8166°E, Alt: 82m)
- Event: Extremely Severe Cyclonic Storm Tauktae (May 15, 2021)
- Scans: 3 consecutive scans spanning 21 min 25 sec (00:36:46 to 00:58:11 UTC)
"""

import os
import datetime
import threading
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from scipy.io import netcdf_file

from src.services.radar_provider import (
    RadarDataProvider,
    RadarFrame,
    NODATA_VALUE_DEFAULT,
)

# Physical conversion constants around 15.5°N (Goa)
KM_PER_DEG_LAT = 110.574
KM_PER_DEG_LON_GOA = 111.320 * np.cos(np.radians(15.4833)) # ~107.284 km

@dataclass
class NetCDFRadarStationInfo:
    station_id: str
    station_name: str
    latitude: float
    longitude: float
    altitude_m: float
    wavelength_m: float
    beamwidth_deg: float


class IMDNetCDFVolumeReader:
    """
    Reader for genuine IMD DWR Level-II NetCDF-3 single-sweep files.
    Extracts calibrated physical reflectivity (dBZ), geometry, and coordinates.
    """

    def __init__(self, file_path: str):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"IMD NetCDF file not found at: {file_path}")
        self.file_path = file_path
        self._station: Optional[NetCDFRadarStationInfo] = None
        self._meta: Dict[str, Any] = {}
        self._raw_z: Optional[np.ndarray] = None
        self._azimuths: Optional[np.ndarray] = None
        self._load_and_parse()

    def _load_and_parse(self):
        with netcdf_file(self.file_path, 'r', mmap=False) as f:
            lat = float(f.variables['siteLat'].data)
            lon = float(f.variables['siteLon'].data)
            alt = float(f.variables['siteAlt'].data)
            wavelen = float(f.variables['waveLength'].data) if 'waveLength' in f.variables else 0.053
            beamwidth = float(f.variables['beamWidthHori'].data) if 'beamWidthHori' in f.variables else 1.0

            self._station = NetCDFRadarStationInfo(
                station_id="GOA",
                station_name="IMD Goa DWR",
                latitude=round(lat, 4),
                longitude=round(lon, 4),
                altitude_m=round(alt, 1),
                wavelength_m=wavelen,
                beamwidth_deg=beamwidth
            )

            # Timestamp extraction: esStartTime is epoch seconds float
            epoch_sec = float(f.variables['esStartTime'].data)
            dt_utc = datetime.datetime.fromtimestamp(epoch_sec, tz=datetime.timezone.utc)
            iso_timestamp = dt_utc.strftime('%Y-%m-%dT%H:%M:%SZ')

            elev = float(f.variables['elevationAngle'].data) if 'elevationAngle' in f.variables else 0.5
            gate_size_m = float(f.variables['gateSize'].data) if 'gateSize' in f.variables else 1000.0
            unambig_range_km = float(f.variables['unambigRange'].data) if 'unambigRange' in f.variables else 500.0

            self._meta = {
                "station": self._station.station_name,
                "station_id": self._station.station_id,
                "lat": self._station.latitude,
                "lon": self._station.longitude,
                "altitude_m": self._station.altitude_m,
                "wavelength_m": self._station.wavelength_m,
                "wavelength_cm": round(self._station.wavelength_m * 100.0, 2),
                "beamwidth_deg": self._station.beamwidth_deg,
                "timestamp_utc": iso_timestamp,
                "epoch_sec": epoch_sec,
                "elevation_deg": round(elev, 2),
                "gate_size_m": gate_size_m,
                "gate_size_km": gate_size_m / 1000.0,
                "unambig_range_km": unambig_range_km,
            }

            # Copy arrays to memory so netcdf_file cleanly detaches
            self._raw_z = f.variables['Z'].data.copy()
            if 'radialAzim' in f.variables:
                self._azimuths = f.variables['radialAzim'].data.copy()
            else:
                self._azimuths = np.linspace(0.0, 359.0, 360, dtype=np.float32)

    @property
    def station(self) -> NetCDFRadarStationInfo:
        return self._station

    @property
    def radar_meta(self) -> Dict[str, Any]:
        return self._meta

    def get_raw_reflectivity_slice(self) -> np.ndarray:
        """Returns the raw uncompressed 2D int8 array (rays x bins)."""
        return self._raw_z

    def get_calibrated_reflectivity_slice(self) -> np.ndarray:
        """
        Returns calibrated 2D dBZ array (rays x bins).
        Calibration equation: dBZ = raw * 0.5 + 32.0.
        Nodata sentinel raw == -128 is mapped to NODATA_VALUE_DEFAULT (-9999.0).
        """
        valid_mask = (self._raw_z != -128)
        calibrated = np.full(self._raw_z.shape, NODATA_VALUE_DEFAULT, dtype=np.float32)
        calibrated[valid_mask] = self._raw_z[valid_mask].astype(np.float32) * 0.5 + 32.0
        return calibrated

    def to_cartesian_grid(
        self,
        grid_h: int = 40,
        grid_w: int = 40,
        extent_km: float = 150.0
    ) -> Tuple[np.ndarray, np.ndarray, List[Tuple[float, float]], Dict[str, float]]:
        """
        Projects polar radar measurements (rays, bins) onto a 2D Cartesian grid centered on Goa radar.
        
        Returns:
            cartesian_dbz: 2D float32 array (grid_h, grid_w)
            valid_mask: 2D boolean array (True where echo is physically detected)
            bounds: 4-corner bounding box [NW, NE, SE, SW] in [lon, lat]
            resolution_km: {'dx': float, 'dy': float}
        """
        calibrated_polar = self.get_calibrated_reflectivity_slice()
        n_rays, n_bins = calibrated_polar.shape
        gate_km = self._meta["gate_size_km"]
        max_range_km = min(self._meta["unambig_range_km"], n_bins * gate_km)

        # Coordinate grid in km from radar origin: Top = North (+y), Right = East (+x)
        x_km = np.linspace(-extent_km, extent_km, grid_w, dtype=np.float32)
        y_km = np.linspace(extent_km, -extent_km, grid_h, dtype=np.float32)
        xx, yy = np.meshgrid(x_km, y_km)

        r_grid = np.sqrt(xx**2 + yy**2)
        theta_grid = (np.degrees(np.arctan2(xx, yy)) + 360.0) % 360.0

        cartesian_dbz = np.full((grid_h, grid_w), NODATA_VALUE_DEFAULT, dtype=np.float32)
        cartesian_mask = np.zeros((grid_h, grid_w), dtype=bool)

        bin_indices = (r_grid / gate_km).astype(np.int32)
        in_range_mask = (r_grid <= max_range_km) & (bin_indices < n_bins)

        # Map azimuth angle to ray index (1.0 deg steps around 360)
        ray_indices = (np.round(theta_grid / (360.0 / n_rays)).astype(np.int32)) % n_rays

        for row in range(grid_h):
            for col in range(grid_w):
                if in_range_mask[row, col]:
                    r_idx = ray_indices[row, col]
                    b_idx = bin_indices[row, col]
                    val = calibrated_polar[r_idx, b_idx]
                    if val > NODATA_VALUE_DEFAULT + 1.0:
                        cartesian_dbz[row, col] = val
                        cartesian_mask[row, col] = True

        # Calculate exact geographic bounds for Goa DWR domain
        nw_lat = self.station.latitude + (extent_km / KM_PER_DEG_LAT)
        nw_lon = self.station.longitude - (extent_km / KM_PER_DEG_LON_GOA)
        se_lat = self.station.latitude - (extent_km / KM_PER_DEG_LAT)
        se_lon = self.station.longitude + (extent_km / KM_PER_DEG_LON_GOA)

        bounds: List[Tuple[float, float]] = [
            (round(nw_lon, 4), round(nw_lat, 4)), # NW
            (round(se_lon, 4), round(nw_lat, 4)), # NE
            (round(se_lon, 4), round(se_lat, 4)), # SE
            (round(nw_lon, 4), round(se_lat, 4)), # SW
        ]

        resolution_km = {
            "dx": round((2.0 * extent_km) / grid_w, 4),
            "dy": round((2.0 * extent_km) / grid_h, 4),
        }

        return cartesian_dbz, cartesian_mask, bounds, resolution_km

    def to_radar_frame(
        self,
        frame_index: int = 0,
        relative_time_min: int = 0,
        grid_h: int = 40,
        grid_w: int = 40,
        extent_km: float = 150.0
    ) -> RadarFrame:
        """Converts observational NetCDF scan into the canonical VAJRA RadarFrame contract."""
        cartesian_dbz, valid_mask, bounds, resolution_km = self.to_cartesian_grid(
            grid_h=grid_h,
            grid_w=grid_w,
            extent_km=extent_km
        )

        valid_vals = cartesian_dbz[valid_mask]
        min_dbz = float(np.min(valid_vals)) if len(valid_vals) > 0 else 0.0
        max_dbz = float(np.max(valid_vals)) if len(valid_vals) > 0 else 0.0
        filename = os.path.basename(self.file_path)

        return RadarFrame(
            frame_index=frame_index,
            relative_time_min=relative_time_min,
            reflectivity_dbz=cartesian_dbz,
            width=grid_w,
            height=grid_h,
            geographic_bounds=bounds,
            spatial_resolution_km=resolution_km,
            nodata_value=NODATA_VALUE_DEFAULT,
            valid_mask=valid_mask,
            min_dbz=min_dbz,
            max_dbz=max_dbz,
            source_id=filename,
            source_type="imd_goa_netcdf",
            synthetic_demo=False,
            timestamp_utc=self._meta["timestamp_utc"]
        )


class IMDNetCDFRadarProvider(RadarDataProvider):
    """
    Multi-frame observational RadarDataProvider wrapping genuine sequential NetCDF scans
    from IMD Goa DWR during Cyclone Tauktae. Exposes 3 real temporal frames.
    """

    FILE_OFFSETS_MIN = [0, 11, 21]

    def __init__(self, data_dir: Optional[str] = None):
        self._lock = threading.Lock()
        if data_dir is None:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
            data_dir = os.path.join(base_dir, 'data', 'real_multiframe')
        self._data_dir = data_dir
        self._readers: List[IMDNetCDFVolumeReader] = []
        self._frames_cache: Dict[int, RadarFrame] = {}
        self._file_paths: List[str] = []

    def _ensure_loaded(self):
        if len(self._readers) == 0:
            with self._lock:
                if len(self._readers) == 0:
                    if not os.path.exists(self._data_dir):
                        raise FileNotFoundError(f"Multi-frame radar directory missing: {self._data_dir}")
                    
                    nc_files = sorted([f for f in os.listdir(self._data_dir) if f.endswith('.nc')])
                    if len(nc_files) == 0:
                        raise FileNotFoundError(f"No NetCDF radar files found in {self._data_dir}")

                    self._file_paths = [os.path.join(self._data_dir, f) for f in nc_files]
                    self._readers = [IMDNetCDFVolumeReader(p) for p in self._file_paths]

    def get_frame_count(self) -> int:
        self._ensure_loaded()
        return len(self._readers)

    def get_available_frames(self) -> List[int]:
        count = self.get_frame_count()
        return list(range(count))

    def get_frame(self, frame_index: int) -> RadarFrame:
        self._ensure_loaded()
        total_frames = len(self._readers)
        if frame_index < 0 or frame_index >= total_frames:
            raise IndexError(f"Frame index {frame_index} out of range (0 to {total_frames - 1})")

        if frame_index in self._frames_cache:
            return self._frames_cache[frame_index]

        reader = self._readers[frame_index]
        rel_time = self.FILE_OFFSETS_MIN[frame_index] if frame_index < len(self.FILE_OFFSETS_MIN) else frame_index * 10
        frame = reader.to_radar_frame(frame_index=frame_index, relative_time_min=rel_time)

        with self._lock:
            self._frames_cache[frame_index] = frame

        return frame

    def get_metadata(self) -> Dict[str, Any]:
        self._ensure_loaded()
        frame0 = self.get_frame(0)
        st = self._readers[0].station
        all_timestamps = [r.radar_meta["timestamp_utc"] for r in self._readers]

        return {
            "source_type": "imd_goa_netcdf",
            "source_id": "IMD_Goa_DWR_Cyclone_Tauktae",
            "provider_class": "IMDNetCDFRadarProvider",
            "station": {
                "id": st.station_id,
                "name": st.station_name,
                "latitude": st.latitude,
                "longitude": st.longitude,
                "altitude_m": st.altitude_m,
                "band": "C-band (5.3 cm)",
            },
            "synthetic_demo": False,
            "status_disclosure": "REAL IMD DWR • GOA • HISTORICAL DATA",
            "disclaimer": "Genuine Level-II C-band Doppler Weather Radar volumetric scans from IMD Goa DWR during Cyclone Tauktae. Offline multi-frame validation sequence.",
            "frame_count": len(self._readers),
            "interval_minutes": 11,
            "temporal_range": {
                "start_offset_min": 0,
                "end_offset_min": self.FILE_OFFSETS_MIN[-1] if len(self.FILE_OFFSETS_MIN) >= len(self._readers) else 21,
                "timestamps_utc": all_timestamps
            },
            "grid": {
                "width": frame0.width,
                "height": frame0.height
            },
            "units": "dBZ",
            "valid_range": {
                "min_dbz": frame0.min_dbz,
                "max_dbz": max(self.get_frame(i).max_dbz for i in range(len(self._readers)))
            },
            "nodata_value": NODATA_VALUE_DEFAULT,
            "bounds": frame0.geographic_bounds,
            "spatial_resolution_km": frame0.spatial_resolution_km
        }
