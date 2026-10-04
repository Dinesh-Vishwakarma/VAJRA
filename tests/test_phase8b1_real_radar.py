"""
VAJRA Phase 8B-1: Real IMD DWR Single-Frame Ingestion Test Suite.

Validates:
1. File exists (data/2024050210404500dBZ.vol).
2. File opens successfully with RainbowVolumeReader.
3. Reflectivity field exists in raw polar data.
4. Reflectivity values are floating-point physical dBZ scalars.
5. Radar origin is available with valid coordinates (Chennai DWR).
6. Source timestamp is available and parsed correctly.
7. Cartesian projection succeeds into 2D grid.
8. Canonical RadarFrame contract is accurately generated.
9. Valid data mask exists, distinguishing real echoes from nodata.
10. Synthetic provider remains untouched as active default.
11. Existing Phase 7 test suite continues to pass.
"""

import os
import sys
import numpy as np

# Ensure root directory is on Python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.services.rainbow_volume_reader import RainbowVolumeReader, IMDScientificRadarProvider
from src.services.radar_provider import (
    get_radar_provider,
    SyntheticRadarProvider,
    RadarFrame,
    reset_radar_provider_for_testing
)

DATA_PATH = os.path.join(ROOT_DIR, 'data', '2024050210404500dBZ.vol')


def test_1_file_exists():
    """1. Test that the genuine IMD Chennai DWR volume file exists."""
    assert os.path.exists(DATA_PATH), f"Target file missing at: {DATA_PATH}"
    file_size = os.path.getsize(DATA_PATH)
    assert file_size > 50000, f"Expected file size > 50KB, got {file_size} bytes"
    print(f"  [PASS] Test 1: File exists ({file_size} bytes)")


def test_2_file_opens_successfully():
    """2. Test that RainbowVolumeReader opens the file and extracts XML header and BLOBs."""
    reader = RainbowVolumeReader(DATA_PATH)
    assert reader.xml_root is not None, "XML root element was not parsed"
    assert len(reader.blobs) > 0, "No binary data BLOBs were indexed"
    print(f"  [PASS] Test 2: File parsed successfully ({len(reader.blobs)} BLOBs indexed)")


def test_3_reflectivity_field_exists():
    """3. Test that the raw reflectivity field exists in the first elevation sweep."""
    reader = RainbowVolumeReader(DATA_PATH)
    raw_refl = reader.get_raw_reflectivity_slice(sweep_idx=0)
    assert raw_refl is not None, "Reflectivity slice returned None"
    assert raw_refl.ndim == 2, f"Expected 2D array (rays x gates), got shape {raw_refl.shape}"
    rays, gates = raw_refl.shape
    assert rays >= 360, f"Expected at least 360 azimuth rays, got {rays}"
    assert gates >= 1000, f"Expected at least 1000 range gates, got {gates}"
    print(f"  [PASS] Test 3: Raw reflectivity field exists with shape {raw_refl.shape}")


def test_4_reflectivity_is_floating_scalar():
    """4. Test that calibrated reflectivity values are floating-point scalar dBZ within plausible physical limits."""
    reader = RainbowVolumeReader(DATA_PATH)
    calib_refl = reader.get_calibrated_reflectivity_slice(sweep_idx=0)
    assert np.issubdtype(calib_refl.dtype, np.floating), f"Expected float dtype, got {calib_refl.dtype}"
    
    # Check valid (non-nodata) echoes
    valid_echoes = calib_refl[calib_refl > -35.0]
    assert len(valid_echoes) > 0, "No valid precipitation echoes detected above -35 dBZ"
    min_dbz = float(np.min(valid_echoes))
    max_dbz = float(np.max(valid_echoes))
    
    # Severe thunderstorm / convective cores reach up to 60-70 dBZ
    assert min_dbz >= -32.0, f"Minimum dBZ {min_dbz} implausibly low"
    assert max_dbz <= 85.0, f"Maximum dBZ {max_dbz} implausibly high for meteorological radar"
    assert max_dbz >= 50.0, f"Expected severe storm core > 50 dBZ in Chennai dataset, got {max_dbz}"
    print(f"  [PASS] Test 4: Reflectivity is float32 with valid physical range [{min_dbz:.2f}, {max_dbz:.2f}] dBZ")


def test_5_radar_origin_available():
    """5. Test that radar station metadata and geographic origin are accurately extracted."""
    reader = RainbowVolumeReader(DATA_PATH)
    meta = reader.radar_meta
    assert "lat" in meta and meta["lat"] is not None, "Radar latitude missing"
    assert "lon" in meta and meta["lon"] is not None, "Radar longitude missing"
    
    # Chennai DWR is located around Lat 13.0728° N, Lon 80.2883° E
    assert abs(meta["lat"] - 13.0728) < 0.1, f"Latitude {meta['lat']} does not match Chennai DWR (~13.0728)"
    assert abs(meta["lon"] - 80.2883) < 0.1, f"Longitude {meta['lon']} does not match Chennai DWR (~80.2883)"
    assert "station" in meta and "chennai" in meta["station"].lower(), f"Unexpected station name: {meta.get('station')}"
    print(f"  [PASS] Test 5: Radar origin verified at {meta['station']} ({meta['lat']:.4f}°N, {meta['lon']:.4f}°E)")


def test_6_timestamp_available():
    """6. Test that the acquisition timestamp is correctly extracted from the file."""
    reader = RainbowVolumeReader(DATA_PATH)
    ts = reader.radar_meta.get("timestamp_utc")
    assert ts is not None, "Timestamp UTC missing from metadata"
    assert ts.startswith("2024-05-02T10:40:45"), f"Unexpected timestamp: {ts}"
    print(f"  [PASS] Test 6: Timestamp extracted: {ts}")


def test_7_cartesian_projection_succeeds():
    """7. Test conversion of polar radar coordinates (azimuth, range) to 2D Cartesian grid."""
    reader = RainbowVolumeReader(DATA_PATH)
    grid_w, grid_h = 100, 100
    cart_grid, mask, bounds, res = reader.to_cartesian_grid(slice_idx=0, grid_h=grid_h, grid_w=grid_w, extent_km=150.0)
    
    assert cart_grid.shape == (grid_h, grid_w), f"Expected shape ({grid_h}, {grid_w}), got {cart_grid.shape}"
    assert mask.shape == (grid_h, grid_w), f"Expected mask shape ({grid_h}, {grid_w}), got {mask.shape}"
    assert len(bounds) == 4, f"Expected 4 coordinate corners, got {len(bounds)}"
    
    # Check that geographic bounds encompass Chennai
    nw, ne, se, sw = bounds
    assert nw[0] < ne[0], "Northwest longitude must be less than Northeast longitude"
    assert sw[1] < nw[1], "Southwest latitude must be less than Northwest latitude"
    print(f"  [PASS] Test 7: Cartesian projection succeeded ({grid_w}x{grid_h}) with bounds NW={nw}, SE={se}")


def test_8_radar_frame_generated():
    """8. Test that the canonical RadarFrame model is populated correctly."""
    reader = RainbowVolumeReader(DATA_PATH)
    frame = reader.to_radar_frame(slice_idx=0, grid_h=100, grid_w=100, extent_km=150.0)
    
    assert isinstance(frame, RadarFrame), "Output is not an instance of RadarFrame"
    assert frame.frame_index == 0, f"Expected frame_index=0, got {frame.frame_index}"
    assert frame.relative_time_min == 0, f"Expected relative_time_min=0, got {frame.relative_time_min}"
    assert frame.width == 100 and frame.height == 100
    assert frame.source_type in ("dwr_sband_rainbow", "imd_dwr_chennai")
    assert frame.synthetic_demo is False, "Synthetic demo flag must be False for real radar data"
    assert "2024-05-02" in (frame.timestamp_utc or ""), f"Timestamp not populated: {frame.timestamp_utc}"
    assert frame.max_dbz > 40.0, f"Expected significant max dBZ in storm frame, got {frame.max_dbz}"
    print(f"  [PASS] Test 8: Canonical RadarFrame generated (max_dbz={frame.max_dbz:.2f}, synthetic={frame.synthetic_demo})")



def test_9_valid_mask_exists():
    """9. Test that an explicit boolean valid_mask distinguishes real echoes from nodata."""
    reader = RainbowVolumeReader(DATA_PATH)
    frame = reader.to_radar_frame(sweep_idx=0)
    
    assert frame.valid_mask is not None, "Valid mask is None"
    assert frame.valid_mask.dtype == bool, f"Expected bool mask, got {frame.valid_mask.dtype}"
    assert frame.valid_mask.shape == frame.reflectivity_dbz.shape
    
    valid_count = int(np.sum(frame.valid_mask))
    nodata_count = int(np.sum(~frame.valid_mask))
    assert valid_count > 0, "Valid mask contains no true values"
    assert nodata_count > 0, "Valid mask contains no nodata values (corners should be nodata outside radar circle)"
    
    # Valid reflectivity getter behaves properly
    cleaned = frame.get_valid_reflectivity()
    assert np.all(cleaned[~frame.valid_mask] == 0.0), "get_valid_reflectivity did not zero out nodata values"
    print(f"  [PASS] Test 9: Valid mask verified ({valid_count} valid cells, {nodata_count} masked nodata cells)")


def test_10_synthetic_provider_remains_unchanged():
    """10. Test that SyntheticRadarProvider remains active default and unaffected."""
    # Ensure environment is default
    if "RADAR_DATA_SOURCE" in os.environ:
        del os.environ["RADAR_DATA_SOURCE"]
    reset_radar_provider_for_testing(None)
    
    provider = get_radar_provider()
    assert isinstance(provider, SyntheticRadarProvider), f"Default provider is not SyntheticRadarProvider: {type(provider)}"
    assert provider.get_frame_count() == 18, f"Synthetic frame count modified: {provider.get_frame_count()}"
    frame = provider.get_frame(0)
    assert frame.synthetic_demo is True, "Synthetic demo flag must remain True on synthetic provider"
    assert frame.source_type == "synthetic"
    
    # Test activating IMD provider explicitly via RADAR_DATA_SOURCE=imd_sample
    os.environ["RADAR_DATA_SOURCE"] = "imd_sample"
    reset_radar_provider_for_testing(None)
    imd_provider = get_radar_provider()
    assert isinstance(imd_provider, IMDScientificRadarProvider), f"Expected IMDScientificRadarProvider, got {type(imd_provider)}"
    assert imd_provider.get_frame_count() == 1
    imd_frame = imd_provider.get_frame(0)
    assert imd_frame.synthetic_demo is False
    assert imd_frame.source_type in ("dwr_sband_rainbow", "imd_dwr_chennai")

    
    # Clean up environment
    del os.environ["RADAR_DATA_SOURCE"]
    reset_radar_provider_for_testing(None)
    print("  [PASS] Test 10: Synthetic provider remains intact as default; imd_sample activates cleanly")


def test_11_existing_phase7_tests_pass():
    """11. Execute Phase 7 test suite functions to ensure backward compatibility."""
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
    print("  [PASS] Test 11: All 9 Phase 7 regression tests passed successfully")



if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("VAJRA PHASE 8B-1: REAL IMD DWR SINGLE-FRAME INGESTION TEST SUITE")
    print("=" * 70)
    
    test_1_file_exists()
    test_2_file_opens_successfully()
    test_3_reflectivity_field_exists()
    test_4_reflectivity_is_floating_scalar()
    test_5_radar_origin_available()
    test_6_timestamp_available()
    test_7_cartesian_projection_succeeds()
    test_8_radar_frame_generated()
    test_9_valid_mask_exists()
    test_10_synthetic_provider_remains_unchanged()
    test_11_existing_phase7_tests_pass()
    
    print("\n" + "=" * 70)
    print("ALL 11 REAL-RADAR INGESTION & REGRESSION TESTS PASSED (100% SUCCESS)")
    print("=" * 70 + "\n")
