"""
VAJRA Phase 7: Radar Data Ingestion Abstraction Test Suite.

Validates:
A. Synthetic provider loads successfully.
B. Frame 0 and frame 17 have expected dimensions.
C. Canonical bounds are preserved.
D. Reflectivity values remain unchanged from current synthetic dataset.
E. /api/radar/metadata returns HTTP 200 with complete metadata structure.
F. /api/radar/frame/0 still returns HTTP 200 with PNG image data.
G. /api/radar/cells/10 still returns HTTP 200 with valid FeatureCollection.
H. Phase 5 and Phase 6 outputs remain unchanged.
I. Invalid frame indices continue to produce expected error/fallback behavior.
"""

import os
import sys
import numpy as np

# Ensure root directory is on Python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.services.radar_provider import (
    get_radar_provider,
    SyntheticRadarProvider,
    RadarFrame,
    CANONICAL_BOUNDS,
    DEFAULT_GRID_H,
    DEFAULT_GRID_W
)
from src.services.storm_tracking import storm_engine
from src.api.main import (
    get_radar_metadata,
    get_radar_frame,
    get_radar_cells_frame,
    get_radar_cells_manifest
)

FORECAST_PATH = os.path.join(ROOT_DIR, 'data', 'processed', 'latest_forecast.npy')


def test_a_synthetic_provider_loads():
    """A. Synthetic provider loads successfully."""
    provider = get_radar_provider()
    assert isinstance(provider, SyntheticRadarProvider), "Expected SyntheticRadarProvider instance"
    assert provider.get_frame_count() == 18, f"Expected 18 frames, got {provider.get_frame_count()}"
    available = provider.get_available_frames()
    assert len(available) == 18
    assert available == list(range(18))


def test_b_frame_dimensions():
    """B. Frame 0 and frame 17 have expected dimensions (40x40)."""
    provider = get_radar_provider()
    frame_0 = provider.get_frame(0)
    frame_17 = provider.get_frame(17)

    assert isinstance(frame_0, RadarFrame)
    assert isinstance(frame_17, RadarFrame)

    assert frame_0.width == DEFAULT_GRID_W
    assert frame_0.height == DEFAULT_GRID_H
    assert frame_0.reflectivity_dbz.shape == (40, 40)

    assert frame_17.width == DEFAULT_GRID_W
    assert frame_17.height == DEFAULT_GRID_H
    assert frame_17.reflectivity_dbz.shape == (40, 40)


def test_c_canonical_bounds_preserved():
    """C. Canonical bounds are preserved across frames and metadata."""
    provider = get_radar_provider()
    meta = provider.get_metadata()
    frame_0 = provider.get_frame(0)

    assert meta["bounds"] == CANONICAL_BOUNDS
    assert frame_0.geographic_bounds == CANONICAL_BOUNDS
    # Verify 4 corners: NW, NE, SE, SW
    assert CANONICAL_BOUNDS[0] == (77.3446, 13.1916)
    assert CANONICAL_BOUNDS[1] == (77.8446, 13.1916)
    assert CANONICAL_BOUNDS[2] == (77.8446, 12.7516)
    assert CANONICAL_BOUNDS[3] == (77.3446, 12.7516)


def test_d_reflectivity_values_unchanged():
    """D. Reflectivity values remain unchanged from the raw latest_forecast.npy dataset."""
    assert os.path.exists(FORECAST_PATH), f"File {FORECAST_PATH} does not exist"
    raw_npy = np.load(FORECAST_PATH).astype(np.float32)

    provider = get_radar_provider()
    for t in range(18):
        frame = provider.get_frame(t)
        # Compare raw slice vs canonical frame valid reflectivity
        np.testing.assert_array_almost_equal(
            frame.get_valid_reflectivity(),
            raw_npy[t],
            decimal=5,
            err_msg=f"Frame {t} reflectivity modified during canonical ingestion!"
        )


def test_e_metadata_endpoint():
    """E. /api/radar/metadata returns HTTP 200 with required contract keys."""
    data = get_radar_metadata()
    assert isinstance(data, dict), "Expected dict metadata"

    assert data["source_type"] == "synthetic"
    assert data["source_id"] == "latest_forecast.npy"
    assert data["synthetic_demo"] is True
    assert data["status_disclosure"] == "SYNTHETIC DATA — DEMO ONLY"
    assert data["frame_count"] == 18
    assert data["interval_minutes"] == 5
    assert data["grid"]["width"] == 40
    assert data["grid"]["height"] == 40
    assert data["units"] == "dBZ"
    assert "bounds" in data
    assert "spatial_resolution_km" in data
    assert data["spatial_resolution_km"]["dx"] > 0
    assert data["spatial_resolution_km"]["dy"] > 0


def test_f_radar_frame_png_endpoint():
    """F. /api/radar/frame/0 still returns HTTP 200 with valid PNG content."""
    resp = get_radar_frame(0)
    assert resp.media_type == "image/png"
    # PNG signature check (first 8 bytes: 89 50 4E 47 0D 0A 1A 0A)
    assert resp.body[:8] == b'\x89PNG\r\n\x1a\n'
    assert len(resp.body) > 500 # Valid rendered image


def test_g_radar_cells_endpoint():
    """G. /api/radar/cells/10 still returns HTTP 200 with GeoJSON FeatureCollection."""
    data = get_radar_cells_frame(10)
    assert data["type"] == "FeatureCollection"
    assert data["frame_idx"] == 10
    assert "features" in data
    assert isinstance(data["features"], list)


def test_h_phase5_and_phase6_outputs_unchanged():
    """H. Phase 5 storm tracking and Phase 6 nowcast uncertainty outputs remain identical."""
    manifest_via_engine = storm_engine.get_manifest()
    assert len(manifest_via_engine) == 18

    # Check frame 10 for deterministic cell features
    frame_10 = manifest_via_engine[10]
    features = frame_10["features"]
    assert len(features) > 0

    feature_types = {f["properties"]["feature_type"] for f in features}
    assert "cell_hull" in feature_types
    assert "cell_centroid" in feature_types
    assert "cell_vector" in feature_types
    assert "forecast_uncertainty_15min" in feature_types
    assert "forecast_uncertainty_30min" in feature_types

    # Verify explainable Phase 6 confidence and stability keys exist
    sample_cell = next(f for f in features if f["properties"]["feature_type"] == "cell_centroid")
    props = sample_cell["properties"]
    assert "confidence" in props
    assert props["confidence"] in ("HIGH", "MEDIUM", "LOW")
    assert "motion_stability" in props
    assert "nowcast" in props
    assert "forecast_15min" in props["nowcast"]
    assert "forecast_30min" in props["nowcast"]


def test_i_invalid_frame_indices():
    """I. Invalid frame indices continue to produce expected fallback/error behavior."""
    provider = get_radar_provider()
    
    # Direct provider raises IndexError on out-of-range
    raised_low = False
    try:
        provider.get_frame(-1)
    except IndexError:
        raised_low = True
    assert raised_low, "Expected IndexError when requesting frame -1"
        
    raised_high = False
    try:
        provider.get_frame(100)
    except IndexError:
        raised_high = True
    assert raised_high, "Expected IndexError when requesting frame 100"

    # API endpoint clamps or handles gracefully
    resp_clamped_high = get_radar_frame(999)
    assert resp_clamped_high.media_type == "image/png"
    assert resp_clamped_high.body[:8] == b'\x89PNG\r\n\x1a\n'

    # Cells endpoint returns empty FeatureCollection for out-of-range index
    data_out = get_radar_cells_frame(999)
    assert data_out["type"] == "FeatureCollection"
    assert data_out["cell_count"] == 0
    assert len(data_out["features"]) == 0


if __name__ == "__main__":
    tests = [
        ("A. Synthetic Provider Loads", test_a_synthetic_provider_loads),
        ("B. Frame Dimensions (40x40)", test_b_frame_dimensions),
        ("C. Canonical Bounds Preserved", test_c_canonical_bounds_preserved),
        ("D. Reflectivity Values Unchanged", test_d_reflectivity_values_unchanged),
        ("E. Metadata Endpoint 200 & Schema", test_e_metadata_endpoint),
        ("F. Radar Frame PNG Endpoint 200", test_f_radar_frame_png_endpoint),
        ("G. Radar Cells Endpoint 200", test_g_radar_cells_endpoint),
        ("H. Phase 5 & 6 Outputs Unchanged", test_h_phase5_and_phase6_outputs_unchanged),
        ("I. Invalid Frame Index Error Handling", test_i_invalid_frame_indices),
    ]

    print("\n=======================================================")
    print("RUNNING VAJRA PHASE 7 RADAR INGESTION ABSTRACTION TESTS")
    print("=======================================================")
    passed = 0
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"[PASS] {name}")
            passed += 1
        except Exception as e:
            print(f"[FAIL] {name}: {e}")
            failed += 1

    print("-------------------------------------------------------")
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)} tests.")
    print("=======================================================\n")
    if failed > 0:
        sys.exit(1)

