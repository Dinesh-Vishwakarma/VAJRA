"""
VAJRA Phase 8B-2: Real Multi-Frame IMD DWR Ingestion Test Suite.

Validates:
A. All three NetCDF-3 radar files load successfully.
B. Timestamps are correct, distinct, and strictly chronological.
C. Station is verified as IMD Goa DWR.
D. Coordinates are verified (Lat: 15.4833°N, Lon: 73.8166°E, Alt: 82m).
E. Raw-to-dBZ calibration equation (raw * 0.5 + 32.0) is mathematically exact.
F. Nodata sentinel (-128) is cleanly masked to -9999.0 with valid boolean mask.
G. Output reflectivity arrays are float32 scalars.
H. Canonical RadarFrame contract is fully and accurately satisfied.
I. Frame count is exactly 3.
J. Frames are chronologically ordered (Frame 0: 00:36:46Z, Frame 1: 00:47:46Z, Frame 2: 00:58:11Z).
K. Real provider works dynamically through get_radar_provider() factory via RADAR_DATA_SOURCE.
L. Synthetic provider remains untouched as active default.
M. Existing Phase 7 tests still pass.
N. Phase 8B-1 Rainbow .vol reader still functions correctly.
"""

import os
import sys
import numpy as np

# Ensure root directory is on Python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.services.imd_netcdf_reader import IMDNetCDFVolumeReader, IMDNetCDFRadarProvider
from src.services.rainbow_volume_reader import RainbowVolumeReader
from src.services.radar_provider import (
    get_radar_provider,
    SyntheticRadarProvider,
    RadarFrame,
    reset_radar_provider_for_testing
)

DATA_DIR = os.path.join(ROOT_DIR, 'data', 'real_multiframe')
EXPECTED_FILES = [
    'GOA210515003646-IMD-C.nc',
    'GOA210515004746-IMD-C.nc',
    'GOA210515005811-IMD-C.nc',
]
EXPECTED_TIMESTAMPS = [
    '2021-05-15T00:36:46Z',
    '2021-05-15T00:47:46Z',
    '2021-05-15T00:58:11Z',
]


def test_a_all_three_files_load():
    """A. All three NetCDF-3 radar files exist on disk and load successfully."""
    assert os.path.exists(DATA_DIR), f"Directory {DATA_DIR} missing"
    for fname in EXPECTED_FILES:
        fpath = os.path.join(DATA_DIR, fname)
        assert os.path.exists(fpath), f"File {fname} missing in {DATA_DIR}"
        reader = IMDNetCDFVolumeReader(fpath)
        assert reader.station is not None
        assert reader.radar_meta is not None
    print("  [PASS] Test A: All three NetCDF-3 files exist and load successfully")


def test_b_timestamps_chronological():
    """B. Timestamps are verified, distinct, and strictly chronological."""
    readers = [IMDNetCDFVolumeReader(os.path.join(DATA_DIR, f)) for f in EXPECTED_FILES]
    timestamps = [r.radar_meta["timestamp_utc"] for r in readers]
    epochs = [r.radar_meta["epoch_sec"] for r in readers]

    assert timestamps == EXPECTED_TIMESTAMPS, f"Timestamps mismatch: {timestamps} vs {EXPECTED_TIMESTAMPS}"
    assert epochs[0] < epochs[1] < epochs[2], f"Epochs not strictly increasing: {epochs}"
    
    # Delta time checks
    dt1 = epochs[1] - epochs[0] # 660 sec = 11.0 min
    dt2 = epochs[2] - epochs[1] # 625 sec = 10.4 min
    assert 600 <= dt1 <= 700, f"Unexpected dt1: {dt1} seconds"
    assert 600 <= dt2 <= 700, f"Unexpected dt2: {dt2} seconds"
    print(f"  [PASS] Test B: Timestamps are chronological: {timestamps} (dt1={dt1}s, dt2={dt2}s)")


def test_c_station_is_goa():
    """C. Radar station is verified as IMD Goa DWR."""
    reader = IMDNetCDFVolumeReader(os.path.join(DATA_DIR, EXPECTED_FILES[0]))
    assert "goa" in reader.station.station_name.lower() or reader.station.station_id == "GOA"
    assert reader.radar_meta["station_id"] == "GOA"
    print(f"  [PASS] Test C: Station verified as '{reader.station.station_name}' ({reader.station.station_id})")


def test_d_coordinates_accurate():
    """D. Transmitter coordinates are verified (Lat: ~15.4833°N, Lon: ~73.8166°E, Alt: ~82m)."""
    reader = IMDNetCDFVolumeReader(os.path.join(DATA_DIR, EXPECTED_FILES[0]))
    lat = reader.station.latitude
    lon = reader.station.longitude
    alt = reader.station.altitude_m

    assert abs(lat - 15.4833) < 0.05, f"Unexpected latitude: {lat}"
    assert abs(lon - 73.8166) < 0.05, f"Unexpected longitude: {lon}"
    assert abs(alt - 82.0) < 5.0, f"Unexpected altitude: {alt}"
    print(f"  [PASS] Test D: Coordinates verified at Lat={lat:.4f}°N, Lon={lon:.4f}°E, Alt={alt}m")


def test_e_calibration_accurate():
    """E. Raw-to-dBZ calibration equation (raw * 0.5 + 32.0) is mathematically exact."""
    reader = IMDNetCDFVolumeReader(os.path.join(DATA_DIR, EXPECTED_FILES[0]))
    raw_z = reader.get_raw_reflectivity_slice()
    calib_z = reader.get_calibrated_reflectivity_slice()

    # Test random valid entries
    valid_mask = (raw_z != -128)
    assert np.any(valid_mask), "No valid entries found"
    
    expected = raw_z[valid_mask].astype(np.float32) * 0.5 + 32.0
    actual = calib_z[valid_mask]
    np.testing.assert_array_almost_equal(actual, expected, decimal=4)
    print("  [PASS] Test E: dBZ = raw * 0.5 + 32.0 calibration verified")


def test_f_nodata_masking():
    """F. Nodata sentinel (-128) is cleanly converted to -9999.0 with valid mask False."""
    reader = IMDNetCDFVolumeReader(os.path.join(DATA_DIR, EXPECTED_FILES[0]))
    raw_z = reader.get_raw_reflectivity_slice()
    calib_z = reader.get_calibrated_reflectivity_slice()

    nodata_mask = (raw_z == -128)
    assert np.any(nodata_mask), "Expected nodata values in raw array"
    assert np.all(calib_z[nodata_mask] == -9999.0), "Nodata values were not set to -9999.0"
    print(f"  [PASS] Test F: Nodata masking verified ({np.sum(nodata_mask)} nodata cells in sweep)")


def test_g_output_is_float32():
    """G. Output reflectivity arrays are float32 scalars."""
    reader = IMDNetCDFVolumeReader(os.path.join(DATA_DIR, EXPECTED_FILES[0]))
    frame = reader.to_radar_frame(0)
    assert frame.reflectivity_dbz.dtype == np.float32, f"Expected float32, got {frame.reflectivity_dbz.dtype}"
    assert isinstance(frame.min_dbz, float)
    assert isinstance(frame.max_dbz, float)
    print(f"  [PASS] Test G: Output is float32 with valid echo range [{frame.min_dbz:.1f}, {frame.max_dbz:.1f}] dBZ")


def test_h_radar_frame_contract():
    """H. Canonical RadarFrame contract is valid and fully populated."""
    reader = IMDNetCDFVolumeReader(os.path.join(DATA_DIR, EXPECTED_FILES[0]))
    frame = reader.to_radar_frame(frame_index=0, relative_time_min=0, grid_h=40, grid_w=40)
    
    assert isinstance(frame, RadarFrame)
    assert frame.frame_index == 0
    assert frame.relative_time_min == 0
    assert frame.width == 40
    assert frame.height == 40
    assert frame.source_type == "imd_goa_netcdf"
    assert frame.synthetic_demo is False
    assert frame.timestamp_utc == EXPECTED_TIMESTAMPS[0]
    assert len(frame.geographic_bounds) == 4
    
    # Check that bounds encompass Goa
    nw, ne, se, sw = frame.geographic_bounds
    assert nw[0] < ne[0]
    assert sw[1] < nw[1]
    assert 72.0 < nw[0] < 73.0 # West of Goa
    assert 16.0 < nw[1] < 17.5 # North of Goa
    print("  [PASS] Test H: Canonical RadarFrame contract satisfied")


def test_i_frame_count_is_three():
    """I. Multi-frame provider exposes exactly 3 frames."""
    provider = IMDNetCDFRadarProvider(DATA_DIR)
    assert provider.get_frame_count() == 3
    assert provider.get_available_frames() == [0, 1, 2]
    print("  [PASS] Test I: Frame count is exactly 3 ([0, 1, 2])")


def test_j_frames_ordered_correctly():
    """J. Frames 0, 1, 2 are ordered chronologically with correct timestamps and relative times."""
    provider = IMDNetCDFRadarProvider(DATA_DIR)
    f0 = provider.get_frame(0)
    f1 = provider.get_frame(1)
    f2 = provider.get_frame(2)

    assert f0.timestamp_utc == EXPECTED_TIMESTAMPS[0]
    assert f1.timestamp_utc == EXPECTED_TIMESTAMPS[1]
    assert f2.timestamp_utc == EXPECTED_TIMESTAMPS[2]

    assert f0.relative_time_min == 0
    assert f1.relative_time_min == 11
    assert f2.relative_time_min == 21
    print("  [PASS] Test J: Frames are chronologically ordered (T0=0m, T1=11m, T2=21m)")


def test_k_provider_factory_resolution():
    """K. Provider factory resolves IMDNetCDFRadarProvider via RADAR_DATA_SOURCE=imd_goa_netcdf."""
    os.environ["RADAR_DATA_SOURCE"] = "imd_goa_netcdf"
    reset_radar_provider_for_testing(None)
    
    provider = get_radar_provider()
    assert isinstance(provider, IMDNetCDFRadarProvider)
    assert provider.get_frame_count() == 3
    meta = provider.get_metadata()
    assert meta["source_type"] == "imd_goa_netcdf"
    assert meta["status_disclosure"] == "REAL IMD DWR • GOA • HISTORICAL DATA"
    assert meta["synthetic_demo"] is False
    
    # Clean up environment
    del os.environ["RADAR_DATA_SOURCE"]
    reset_radar_provider_for_testing(None)
    print("  [PASS] Test K: Factory resolves IMDNetCDFRadarProvider for imd_goa_netcdf")


def test_l_synthetic_provider_unchanged():
    """L. Synthetic provider remains untouched as active default."""
    if "RADAR_DATA_SOURCE" in os.environ:
        del os.environ["RADAR_DATA_SOURCE"]
    reset_radar_provider_for_testing(None)

    provider = get_radar_provider()
    assert isinstance(provider, SyntheticRadarProvider)
    assert provider.get_frame_count() == 18
    f0 = provider.get_frame(0)
    assert f0.synthetic_demo is True
    assert f0.source_type == "synthetic"
    print("  [PASS] Test L: Synthetic provider remains unchanged as active default")


def test_m_phase7_regression():
    """M. Existing Phase 7 tests still pass."""
    import tests.test_phase7_radar_provider as p7
    p7.test_a_synthetic_provider_loads()
    p7.test_b_frame_dimensions()
    p7.test_c_canonical_bounds_preserved()
    p7.test_d_reflectivity_values_unchanged()
    p7.test_e_metadata_endpoint()
    p7.test_f_radar_frame_png_endpoint()
    p7.test_g_radar_cells_endpoint()
    p7.test_h_phase5_and_phase6_outputs_unchanged()
    p7.test_i_invalid_frame_indices()
    print("  [PASS] Test M: All Phase 7 regression tests pass")


def test_n_phase8b1_rainbow_reader_works():
    """N. Phase 8B-1 Rainbow .vol reader continues to function correctly."""
    vol_path = os.path.join(ROOT_DIR, 'data', '2024050210404500dBZ.vol')
    assert os.path.exists(vol_path)
    reader = RainbowVolumeReader(vol_path)
    frame = reader.to_radar_frame(0)
    assert frame.synthetic_demo is False
    assert frame.source_type in ("dwr_sband_rainbow", "imd_dwr_chennai")
    assert "chennai" in reader.station.station_name.lower() or "chennai" in (frame.source_id or "").lower() or reader.radar_meta["lat"] > 13.0
    print("  [PASS] Test N: Phase 8B-1 Rainbow volume reader still functions correctly")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("VAJRA PHASE 8B-2: REAL MULTI-FRAME IMD DWR INGESTION TEST SUITE")
    print("=" * 70)
    
    test_a_all_three_files_load()
    test_b_timestamps_chronological()
    test_c_station_is_goa()
    test_d_coordinates_accurate()
    test_e_calibration_accurate()
    test_f_nodata_masking()
    test_g_output_is_float32()
    test_h_radar_frame_contract()
    test_i_frame_count_is_three()
    test_j_frames_ordered_correctly()
    test_k_provider_factory_resolution()
    test_l_synthetic_provider_unchanged()
    test_m_phase7_regression()
    test_n_phase8b1_rainbow_reader_works()
    
    print("\n" + "=" * 70)
    print("ALL 14 MULTI-FRAME INGESTION & REGRESSION TESTS PASSED (100% SUCCESS)")
    print("=" * 70 + "\n")
