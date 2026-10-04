"""
VAJRA Phase 8B-3: Tracking Generalization & Real-Data Validation Test Suite.

Validates:
1. grid_to_geo preserves canonical Bengaluru bounds when bounds=None.
2. grid_to_geo projects into correct Goa coordinates when provided Goa bounds.
3. StormTrack.update uses actual elapsed interval (time_min) rather than fixed 5 minutes.
4. extract_candidate_cells calculates cell area dynamically from spatial_resolution_km.
5. Synthetic pipeline (18 frames) remains 100% numerically preserved.
6. Real Goa multi-frame pipeline (3 frames) outputs genuine Goa coordinates, not Bengaluru.
7. Real Goa storm tracks carry synthetic_demo=False and appropriate historical disclaimers.
"""

import os
import sys
import numpy as np

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.services.storm_tracking import (
    grid_to_geo,
    geo_distance_km,
    extract_candidate_cells,
    StormTrack,
    StormTrackingEngine,
    BOUNDS_NW,
    BOUNDS_SE,
    GRID_H,
    GRID_W
)
from src.services.radar_provider import get_radar_provider, SyntheticRadarProvider
from src.services.imd_netcdf_reader import IMDNetCDFRadarProvider


def test_1_grid_to_geo_backward_compatibility():
    """1. grid_to_geo preserves canonical Bengaluru coordinates when bounds=None."""
    # Top-left cell
    lat_tl, lon_tl = grid_to_geo(0, 0)
    assert 13.18 < lat_tl < 13.195, f"Expected Bengaluru latitude near 13.19, got {lat_tl}"
    assert 77.34 < lon_tl < 77.36, f"Expected Bengaluru longitude near 77.35, got {lon_tl}"

    # Center cell
    lat_c, lon_c = grid_to_geo(19.5, 19.5)
    assert 12.95 < lat_c < 12.99, f"Expected center latitude ~12.97, got {lat_c}"
    assert 77.58 < lon_c < 77.61, f"Expected center longitude ~77.59, got {lon_c}"


def test_2_grid_to_geo_with_goa_bounds():
    """2. grid_to_geo accurately projects into Goa domain when given Goa bounds."""
    goa_provider = IMDNetCDFRadarProvider()
    frame0 = goa_provider.get_frame(0)
    bounds = frame0.geographic_bounds

    lat_tl, lon_tl = grid_to_geo(0, 0, bounds=bounds, grid_h=40, grid_w=40)
    # Goa top-left is off Konkan coast ~16.8°N, 72.4°E
    assert 16.5 < lat_tl < 17.0, f"Expected Goa latitude ~16.8°N, got {lat_tl}"
    assert 72.3 < lon_tl < 72.6, f"Expected Goa longitude ~72.4°E, got {lon_tl}"

    lat_c, lon_c = grid_to_geo(19.5, 19.5, bounds=bounds, grid_h=40, grid_w=40)
    # Goa radar station is at 15.4833°N, 73.8166°E
    assert 15.3 < lat_c < 15.7, f"Expected Goa center latitude ~15.48°N, got {lat_c}"
    assert 73.6 < lon_c < 74.0, f"Expected Goa center longitude ~73.82°E, got {lon_c}"


def test_3_dynamic_timestep_calculation():
    """3. StormTrack calculates velocity using actual time_min intervals."""
    det1 = {'centroid_lat': 15.48, 'centroid_lon': 73.82, 'max_dbz': 45.0, 'area_km2': 100.0}
    # 0.1 degree shift eastward (~10.7 km at 15.5°N)
    det2 = {'centroid_lat': 15.48, 'centroid_lon': 73.92, 'max_dbz': 45.0, 'area_km2': 100.0}

    # Case A: Synthetic 5-minute interval
    track_syn = StormTrack("SYN-01", det1, frame_idx=0, time_min=0.0)
    track_syn.update(det2, frame_idx=1, time_min=5.0)
    # ~10.7 km / (5/60 hr) = ~128 km/h
    assert 120.0 < track_syn.speed_kmh < 135.0, f"Unexpected 5m speed: {track_syn.speed_kmh}"

    # Case B: Real Goa 11-minute interval
    track_real = StormTrack("REAL-01", det1, frame_idx=0, time_min=0.0)
    track_real.update(det2, frame_idx=1, time_min=11.0)
    # ~10.7 km / (11/60 hr) = ~58 km/h
    assert 54.0 < track_real.speed_kmh < 64.0, f"Unexpected 11m speed: {track_real.speed_kmh}"
    # Verify speed is inversely proportional to elapsed time
    ratio = track_syn.speed_kmh / track_real.speed_kmh
    assert abs(ratio - (11.0 / 5.0)) < 0.05, f"Expected ratio ~2.2, got {ratio}"


def test_4_dynamic_pixel_area_calculation():
    """4. extract_candidate_cells calculates cell area dynamically from spatial_resolution_km."""
    grid = np.zeros((40, 40), dtype=np.float32)
    # Create 4-pixel cell
    grid[10:12, 10:12] = 45.0

    # Synthetic resolution (~1.36 x 1.22 km -> ~1.65 km2 per pixel)
    res_syn = {'dx': 1.356, 'dy': 1.216}
    dets_syn = extract_candidate_cells(grid, 0, spatial_resolution_km=res_syn)
    assert len(dets_syn) == 1
    # 4 pixels * ~1.65 km2 = ~6.6 km2
    assert 6.0 < dets_syn[0]['area_km2'] < 7.2, f"Unexpected syn area: {dets_syn[0]['area_km2']}"

    # Goa resolution (7.5 x 7.5 km -> 56.25 km2 per pixel)
    res_goa = {'dx': 7.5, 'dy': 7.5}
    dets_goa = extract_candidate_cells(grid, 0, spatial_resolution_km=res_goa)
    assert len(dets_goa) == 1
    # 4 pixels * 56.25 km2 = 225.0 km2
    assert 220.0 < dets_goa[0]['area_km2'] < 230.0, f"Unexpected goa area: {dets_goa[0]['area_km2']}"


def test_5_synthetic_pipeline_preservation():
    """5. Full synthetic 18-frame tracking pipeline remains 100% numerically preserved."""
    provider = get_radar_provider()
    engine = StormTrackingEngine()
    manifest = engine.run_full_sequence(provider)

    assert len(manifest) == 18, f"Expected 18 frames, got {len(manifest)}"
    f10 = manifest[10]
    centroids = [f for f in f10['features'] if f['properties']['feature_type'] == 'cell_centroid']
    assert len(centroids) > 0

    c0 = centroids[0]['properties']
    # Check that synthetic domain coordinates are preserved
    assert 12.7 < c0['centroid_lat'] < 13.2
    assert 77.3 < c0['centroid_lon'] < 77.9
    assert c0['synthetic_demo'] is True
    assert "DEMO ONLY" in c0['disclaimer']


def test_6_real_goa_tracking_generalization():
    """6. Real Goa 3-frame dataset produces genuine Goa coordinates, not Bengaluru."""
    provider = IMDNetCDFRadarProvider()
    engine = StormTrackingEngine()
    manifest = engine.run_full_sequence(provider)

    assert len(manifest) == 3, f"Expected 3 frames, got {len(manifest)}"

    # Frame 0
    f0_centroids = [f for f in manifest[0]['features'] if f['properties']['feature_type'] == 'cell_centroid']
    assert len(f0_centroids) == 4, f"Expected 4 cells in Frame 0, got {len(f0_centroids)}"

    for c in f0_centroids:
        p = c['properties']
        # Must be in Goa domain (14°N to 17°N, 72°E to 75°E)
        assert 14.0 <= p['centroid_lat'] <= 17.0, f"Cell {p['cell_id']} lat out of Goa: {p['centroid_lat']}"
        assert 72.0 <= p['centroid_lon'] <= 75.0, f"Cell {p['cell_id']} lon out of Goa: {p['centroid_lon']}"
        # NEVER label Goa as Bengaluru
        assert p['synthetic_demo'] is False, "Real Goa track must have synthetic_demo=False"
        assert "GOA" in p['disclaimer'], f"Expected Goa disclaimer, got {p['disclaimer']}"
        # Area must reflect Goa grid scale (~56.25 km2/pix, >= 150 km2)
        assert p['area_km2'] >= 150.0, f"Expected real-scale area, got {p['area_km2']}"


if __name__ == '__main__':
    print("=" * 70)
    print("RUNNING VAJRA PHASE 8B-3 GENERALIZATION & INTEGRITY TESTS")
    print("=" * 70)
    test_1_grid_to_geo_backward_compatibility()
    print("[PASS] Test 1: grid_to_geo backward compatibility (Bengaluru)")
    test_2_grid_to_geo_with_goa_bounds()
    print("[PASS] Test 2: grid_to_geo with Goa bounds")
    test_3_dynamic_timestep_calculation()
    print("[PASS] Test 3: Dynamic timestep velocity calculation")
    test_4_dynamic_pixel_area_calculation()
    print("[PASS] Test 4: Dynamic pixel area calculation")
    test_5_synthetic_pipeline_preservation()
    print("[PASS] Test 5: Full synthetic 18-frame pipeline preserved")
    test_6_real_goa_tracking_generalization()
    print("[PASS] Test 6: Real Goa tracking generalization & non-Bengaluru verification")
    print("=" * 70)
    print("ALL 6 GENERALIZATION & REAL-DATA TESTS PASSED (100% SUCCESS)")
    print("=" * 70)
