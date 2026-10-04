"""
VAJRA Phase 8B-1: Real IMD DWR Single-Frame Ingestion Engine.
Parses Leonardo / Gematronik Rainbow 5 volumetric radar files (.vol) and converts
polar scalar reflectivity sweeps into canonical RadarFrame representations.

DATASET CONTEXT:
Source File: data/2024050210404500dBZ.vol
Station: DWR Chennai (CNI), Tamil Nadu, India (S-band Doppler Weather Radar)
Timestamp: 2024-05-02T10:40:45Z (Historical severe convective hail storm)
"""

import os
import re
import zlib
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Tuple
import numpy as np

from src.services.radar_provider import (
    RadarFrame,
    RadarDataProvider,
    NODATA_VALUE_DEFAULT,
    KM_PER_DEG_LAT,
    KM_PER_DEG_LON
)

@dataclass
class RadarStationInfo:
    station_id: str
    station_name: str
    latitude: float
    longitude: float
    altitude_m: float
    wavelength_m: float
    beamwidth_deg: float

@dataclass
class PolarSweepData:
    slice_idx: int
    elevation_deg: float
    timestamp_utc: str
    azimuths_deg: np.ndarray        # 1D array of azimuth angles [0, 360)
    range_step_km: float            # Gate spacing in km (e.g. 0.15 km = 150m)
    stop_range_km: float            # Maximum range in km (e.g. 250 km)
    dbz_matrix: np.ndarray          # 2D scalar array (n_rays, n_bins) in dBZ
    valid_mask: np.ndarray          # 2D boolean array (True where echo is physically detected)


class RainbowVolumeReader:
    """
    Native Python reader for Leonardo / Gematronik Rainbow 5 radar volumes (.vol).
    Extracts XML metadata, decompresses polar ray/gate blobs, and converts to Cartesian.
    """

    def __init__(self, file_path: str):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Rainbow radar file not found at: {file_path}")
        self.file_path = file_path
        self._xml_root: Optional[ET.Element] = None
        self._blobs: Dict[int, bytes] = {}
        self._station: Optional[RadarStationInfo] = None
        self._load_and_parse()

    def _load_and_parse(self):
        with open(self.file_path, 'rb') as f:
            content = f.read()

        xml_end_idx = content.find(b'</volume>')
        if xml_end_idx == -1:
            raise ValueError("Invalid Rainbow volume file: missing </volume> tag")

        xml_bytes = content[:xml_end_idx + 9]
        self._xml_root = ET.fromstring(xml_bytes.decode('latin-1'))

        # Parse station information
        sensor = self._xml_root.find('sensorinfo')
        if sensor is not None:
            self._station = RadarStationInfo(
                station_id=sensor.attrib.get('id', 'UNKNOWN'),
                station_name=sensor.attrib.get('name', 'UNKNOWN'),
                latitude=float(sensor.findtext('lat', '0.0')),
                longitude=float(sensor.findtext('lon', '0.0')),
                altitude_m=float(sensor.findtext('alt', '0.0')),
                wavelength_m=float(sensor.findtext('wavelen', '0.104')),
                beamwidth_deg=float(sensor.findtext('beamwidth', '1.0')),
            )
        else:
            self._station = RadarStationInfo("UNKNOWN", "UNKNOWN", 0.0, 0.0, 0.0, 0.1, 1.0)

        # Parse binary BLOB chunks
        blob_pattern = re.compile(rb'<BLOB\s+blobid="(\d+)"\s+size="(\d+)"\s+compression="([^"]+)">\n')
        for m in blob_pattern.finditer(content):
            blob_id = int(m.group(1))
            size = int(m.group(2))
            comp = m.group(3).decode('ascii')
            start = m.end()
            blob_bytes = content[start:start + size]

            if comp == 'qt':
                # 4-byte big-endian uncompressed size followed by zlib compressed stream
                decomp = zlib.decompress(blob_bytes[4:])
            elif comp == 'gzip':
                import gzip
                decomp = gzip.decompress(blob_bytes)
            else:
                decomp = blob_bytes

            self._blobs[blob_id] = decomp

    @property
    def xml_root(self) -> Optional[ET.Element]:
        return self._xml_root

    @property
    def blobs(self) -> Dict[int, bytes]:
        return self._blobs

    @property
    def station(self) -> RadarStationInfo:
        return self._station

    @property
    def radar_meta(self) -> Dict[str, Any]:
        """Convenience dictionary combining station and scan metadata."""
        scan_meta = self.get_scan_metadata()
        st = self.station
        return {
            "station": st.station_name,
            "station_id": st.station_id,
            "lat": st.latitude,
            "lon": st.longitude,
            "altitude_m": st.altitude_m,
            "wavelength_m": st.wavelength_m,
            "wavelength_cm": round(st.wavelength_m * 100.0, 2),
            "beamwidth_deg": st.beamwidth_deg,
            "timestamp_utc": scan_meta.get("timestamp_utc"),
            "stop_range_km": scan_meta.get("stop_range_km"),
            "range_step_km": scan_meta.get("range_step_km"),
        }

    def get_raw_reflectivity_slice(self, sweep_idx: int = 0) -> np.ndarray:
        """Returns the raw uncompressed 2D array (rays, bins) for a sweep."""
        scan = self._xml_root.find('scan')
        slices = scan.findall('slice') if scan is not None else []
        sl = slices[sweep_idx]
        rawdata = sl.find('slicedata').find('rawdata')
        raw_blobid = int(rawdata.attrib.get('blobid'))
        n_rays = int(rawdata.attrib.get('rays', '360'))
        n_bins = int(rawdata.attrib.get('bins', '1667'))
        raw_bytes = self._blobs[raw_blobid]
        return np.frombuffer(raw_bytes, dtype=np.uint8).reshape((n_rays, n_bins))

    def get_calibrated_reflectivity_slice(self, sweep_idx: int = 0) -> np.ndarray:
        """Returns the calibrated 2D dBZ array (rays, bins) for a sweep."""
        sweep = self.get_slice(sweep_idx)
        return sweep.dbz_matrix

    def get_scan_metadata(self) -> Dict[str, Any]:
        scan = self._xml_root.find('scan')
        pargroup = scan.find('pargroup') if scan is not None else None
        
        date_str = scan.attrib.get('date', '') if scan is not None else ''
        time_str = scan.attrib.get('time', '') if scan is not None else ''
        iso_timestamp = f"{date_str}T{time_str}Z" if date_str and time_str else None

        return {
            "name": scan.attrib.get('name', '') if scan is not None else '',
            "date": date_str,
            "time": time_str,
            "timestamp_utc": iso_timestamp,
            "stop_range_km": float(pargroup.findtext('stoprange', '250.0')) if pargroup is not None else 250.0,
            "range_step_km": float(pargroup.findtext('rangestep', '0.15')) if pargroup is not None else 0.15,
            "num_elevations": int(pargroup.findtext('numele', '1')) if pargroup is not None else 1,
            "scan_strategy": pargroup.findtext('scanstrategy', 'Default') if pargroup is not None else 'Default',
            "polarization": pargroup.findtext('pol', 'SinglePolHor') if pargroup is not None else 'SinglePolHor',
        }


    def get_slice(self, slice_idx: int = 0) -> PolarSweepData:
        """Extract and decompress a specific elevation sweep (default 0 = lowest tilt)."""
        scan = self._xml_root.find('scan')
        slices = scan.findall('slice') if scan is not None else []
        if slice_idx < 0 or slice_idx >= len(slices):
            raise IndexError(f"Slice index {slice_idx} out of range (0 to {len(slices) - 1})")

        sl = slices[slice_idx]
        posangle = sl.find('posangle')
        elev_deg = float(posangle.text) if posangle is not None and posangle.text else 0.2

        slicedata = sl.find('slicedata')
        rayinfo = slicedata.find('rayinfo')
        rawdata = slicedata.find('rawdata')

        ray_blobid = int(rayinfo.attrib.get('blobid'))
        raw_blobid = int(rawdata.attrib.get('blobid'))

        n_rays = int(rawdata.attrib.get('rays', '360'))
        n_bins = int(rawdata.attrib.get('bins', '1667'))
        min_dbz = float(rawdata.attrib.get('min', '-31.5'))
        max_dbz = float(rawdata.attrib.get('max', '95.5'))

        # Decompress ray azimuth angles (16-bit unsigned big endian)
        ray_bytes = self._blobs[ray_blobid]
        angles_raw = np.frombuffer(ray_bytes, dtype='>u2')
        azimuths = (angles_raw * 360.0 / 65536.0).astype(np.float32)

        # Decompress raw reflectivity bytes (8-bit unsigned integer)
        refl_bytes = self._blobs[raw_blobid]
        raw_arr = np.frombuffer(refl_bytes, dtype=np.uint8).reshape((n_rays, n_bins))

        # Calibrated dBZ formula: min + raw * (max - min) / 255.0
        # raw == 0 is below threshold / nodata
        step = (max_dbz - min_dbz) / 255.0
        valid_mask = raw_arr > 0

        calibrated_dbz = np.full((n_rays, n_bins), NODATA_VALUE_DEFAULT, dtype=np.float32)
        calibrated_dbz[valid_mask] = min_dbz + raw_arr[valid_mask].astype(np.float32) * step

        scan_meta = self.get_scan_metadata()
        time_str = slicedata.attrib.get('time', scan_meta['time'])
        date_str = slicedata.attrib.get('date', scan_meta['date'])
        iso_timestamp = f"{date_str}T{time_str}Z"

        return PolarSweepData(
            slice_idx=slice_idx,
            elevation_deg=elev_deg,
            timestamp_utc=iso_timestamp,
            azimuths_deg=azimuths,
            range_step_km=scan_meta['range_step_km'],
            stop_range_km=scan_meta['stop_range_km'],
            dbz_matrix=calibrated_dbz,
            valid_mask=valid_mask
        )

    def to_cartesian_grid(
        self,
        slice_idx: int = 0,
        sweep_idx: Optional[int] = None,
        grid_h: int = 40,
        grid_w: int = 40,
        extent_km: float = 150.0
    ) -> Tuple[np.ndarray, np.ndarray, List[Tuple[float, float]], Dict[str, float]]:
        """
        Projects polar radar measurements (rays, bins) onto a 2D Cartesian grid centered on the radar.
        
        Returns:
            cartesian_dbz: 2D float32 array (grid_h, grid_w)
            valid_mask: 2D boolean array (True where echo is physically detected)
            bounds: 4-corner bounding box [NW, NE, SE, SW] in [lon, lat]
            resolution_km: {'dx': float, 'dy': float}
        """
        if sweep_idx is not None:
            slice_idx = sweep_idx
        sweep = self.get_slice(slice_idx)

        
        # Grid coordinates in km from radar origin: Top = North (+y), Right = East (+x)
        x_km = np.linspace(-extent_km, extent_km, grid_w, dtype=np.float32)
        y_km = np.linspace(extent_km, -extent_km, grid_h, dtype=np.float32)
        xx, yy = np.meshgrid(x_km, y_km)

        r_grid = np.sqrt(xx**2 + yy**2)
        # Azimuth clockwise from North: [0, 360)
        theta_grid = (np.degrees(np.arctan2(xx, yy)) + 360.0) % 360.0

        cartesian_dbz = np.full((grid_h, grid_w), NODATA_VALUE_DEFAULT, dtype=np.float32)
        cartesian_mask = np.zeros((grid_h, grid_w), dtype=bool)

        # Range bin indices: bin = int(r / range_step)
        bin_indices = (r_grid / sweep.range_step_km).astype(np.int32)
        in_range_mask = (r_grid <= sweep.stop_range_km) & (bin_indices < sweep.dbz_matrix.shape[1])

        # Find nearest azimuth ray index for each grid pixel
        # Azimuths are monotonically increasing around 360 deg
        n_rays = len(sweep.azimuths_deg)
        # Normalize azimuth index: round(theta / (360 / n_rays)) % n_rays
        ray_indices = (np.round(theta_grid / (360.0 / n_rays)).astype(np.int32)) % n_rays

        for row in range(grid_h):
            for col in range(grid_w):
                if in_range_mask[row, col]:
                    ray_idx = ray_indices[row, col]
                    b_idx = bin_indices[row, col]
                    val = sweep.dbz_matrix[ray_idx, b_idx]
                    if val > NODATA_VALUE_DEFAULT + 1.0:
                        cartesian_dbz[row, col] = val
                        cartesian_mask[row, col] = True

        # Calculate exact geographic bounds for Chennai DWR domain
        lat_span = (2.0 * extent_km) / KM_PER_DEG_LAT
        lon_span = (2.0 * extent_km) / KM_PER_DEG_LON

        nw_lat = self.station.latitude + (extent_km / KM_PER_DEG_LAT)
        nw_lon = self.station.longitude - (extent_km / KM_PER_DEG_LON)
        se_lat = self.station.latitude - (extent_km / KM_PER_DEG_LAT)
        se_lon = self.station.longitude + (extent_km / KM_PER_DEG_LON)

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
        slice_idx: int = 0,
        sweep_idx: Optional[int] = None,
        grid_h: int = 40,
        grid_w: int = 40,
        extent_km: float = 150.0
    ) -> RadarFrame:
        """Converts raw Doppler volume sweep into the canonical VAJRA RadarFrame contract."""
        if sweep_idx is not None:
            slice_idx = sweep_idx
        cartesian_dbz, valid_mask, bounds, resolution_km = self.to_cartesian_grid(
            slice_idx=slice_idx,
            grid_h=grid_h,
            grid_w=grid_w,
            extent_km=extent_km
        )


        valid_vals = cartesian_dbz[valid_mask]
        min_dbz = float(np.min(valid_vals)) if len(valid_vals) > 0 else 0.0
        max_dbz = float(np.max(valid_vals)) if len(valid_vals) > 0 else 0.0

        scan_meta = self.get_scan_metadata()
        filename = os.path.basename(self.file_path)

        return RadarFrame(
            frame_index=0,
            relative_time_min=0,
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
            source_type="dwr_sband_rainbow",
            synthetic_demo=False,
            timestamp_utc=scan_meta['timestamp_utc']
        )


class IMDScientificRadarProvider(RadarDataProvider):
    """
    Offline/Validation Provider for real Level-II IMD Doppler Weather Radar data.
    Consumes genuine Rainbow .vol volumes and serves canonical RadarFrames.
    """

    def __init__(self, vol_path: Optional[str] = None):
        if vol_path is None:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
            vol_path = os.path.join(base_dir, 'data', '2024050210404500dBZ.vol')
        self._vol_path = vol_path
        self._reader: Optional[RainbowVolumeReader] = None
        self._cached_frame: Optional[RadarFrame] = None

    def _ensure_loaded(self):
        if self._reader is None:
            self._reader = RainbowVolumeReader(self._vol_path)

    def get_frame_count(self) -> int:
        return 1

    def get_available_frames(self) -> List[int]:
        return [0]

    def get_frame(self, frame_index: int) -> RadarFrame:
        if frame_index != 0:
            raise IndexError(f"IMDScientificRadarProvider contains only 1 historical sample frame (index 0). Requested: {frame_index}")
        if self._cached_frame is None:
            self._ensure_loaded()
            self._cached_frame = self._reader.to_radar_frame(slice_idx=0, grid_h=40, grid_w=40, extent_km=150.0)
        return self._cached_frame

    def get_metadata(self) -> Dict[str, Any]:
        self._ensure_loaded()
        frame = self.get_frame(0)
        st = self._reader.station
        scan_meta = self._reader.get_scan_metadata()

        return {
            "source_type": "dwr_sband_rainbow",
            "source_id": os.path.basename(self._vol_path),
            "provider_class": "IMDScientificRadarProvider",
            "synthetic_demo": False,
            "status_disclosure": "REAL IMD DWR — CHENNAI • OFFLINE HISTORICAL SAMPLE",
            "disclaimer": "Genuine Level-II S-band Doppler Weather Radar volume scan from IMD Chennai Port DWR. Offline architectural validation sample.",
            "station": {
                "id": st.station_id,
                "name": st.station_name,
                "latitude": st.latitude,
                "longitude": st.longitude,
                "altitude_m": st.altitude_m,
                "band": "S-band (10.4 cm)",
            },
            "scan_metadata": scan_meta,
            "frame_count": 1,
            "interval_minutes": 0,
            "temporal_range": {
                "start_offset_min": 0,
                "end_offset_min": 0
            },
            "grid": {
                "width": frame.width,
                "height": frame.height
            },
            "units": "dBZ",
            "valid_range": {
                "min_dbz": frame.min_dbz,
                "max_dbz": frame.max_dbz
            },
            "nodata_value": NODATA_VALUE_DEFAULT,
            "bounds": frame.geographic_bounds,
            "spatial_resolution_km": frame.spatial_resolution_km
        }
