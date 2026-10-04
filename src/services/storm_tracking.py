"""
Deterministic Storm Cell Detection and Tracking Engine for VAJRA.
Processes synthetic radar scalar reflectivity field (latest_forecast.npy).

DISCLAIMER: SYNTHETIC CELL TRACKING — DEMO ONLY.
Do not use for operational meteorological forecasting.
"""

import os
import threading
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from scipy.ndimage import label
from scipy.spatial import ConvexHull

# Georeferencing canonical constants (Bengaluru Domain)
BOUNDS_NW = (77.3446, 13.1916)
BOUNDS_SE = (77.8446, 12.7516)
LAT_SPAN = 0.4400
LON_SPAN = 0.5000
GRID_H = 40
GRID_W = 40

# Conversion constants around 13°N
# 1 deg lat ~ 110.574 km, 1 deg lon ~ 111.320 * cos(13°) ~ 108.48 km
KM_PER_DEG_LAT = 110.574
KM_PER_DEG_LON = 108.48
PIXEL_AREA_KM2 = (LAT_SPAN / GRID_H * KM_PER_DEG_LAT) * (LON_SPAN / GRID_W * KM_PER_DEG_LON) # ~1.653 km^2

# Thresholds
ENVELOPE_THRESHOLD_DBZ = 30.0
CORE_THRESHOLD_DBZ = 40.0
MIN_CELL_PIXELS = 3
MAX_ASSOCIATION_GATE_KM = 5.0
FRAME_INTERVAL_MIN = 5.0

def grid_to_geo(y: float, x: float) -> Tuple[float, float]:
    """Convert continuous grid indices (y: row North->South, x: col West->East) to (lat, lon)."""
    lat = 13.1916 - ((y + 0.5) / float(GRID_H)) * LAT_SPAN
    lon = 77.3446 + ((x + 0.5) / float(GRID_W)) * LON_SPAN
    return lat, lon

def geo_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float, float]:
    """Calculate Euclidean flat-earth distance (km), d_lon (km), and d_lat (km) around 13°N."""
    d_lat = (lat2 - lat1) * KM_PER_DEG_LAT
    d_lon = (lon2 - lon1) * KM_PER_DEG_LON
    return float(np.sqrt(d_lat**2 + d_lon**2)), float(d_lon), float(d_lat)

def get_intensity_class(dbz: float) -> str:
    """Map reflectivity to display intensity class."""
    if dbz >= 60.0:
        return "EXTREME"
    elif dbz >= 50.0:
        return "SEVERE"
    elif dbz >= 40.0:
        return "STRONG"
    else:
        return "MODERATE"

class StormTrack:
    """Represents a tracked convective cell across consecutive frames."""
    def __init__(self, track_id: str, det: Dict[str, Any], frame_idx: int):
        self.track_id = track_id
        self.first_seen = frame_idx
        self.last_seen = frame_idx
        self.lost_count = 0
        self.history: List[Dict[str, Any]] = []
        self.velocity_history: List[Tuple[float, float]] = [] # [(u_meas, v_meas), ...]
        self.u_kmh = 0.0 # Eastward component (km/h)
        self.v_kmh = 0.0 # Northward component (km/h)
        self.speed_kmh = 0.0
        self.bearing_deg = 0.0
        self.status = "ACTIVE"
        self.update(det, frame_idx)

    def predict_next_pos(self) -> Tuple[float, float]:
        """Extrapolate position 5 minutes ahead based on smoothed velocity."""
        dt_hr = FRAME_INTERVAL_MIN / 60.0
        last_det = self.history[-1]
        pred_lat = last_det['centroid_lat'] + (self.v_kmh * dt_hr) / KM_PER_DEG_LAT
        pred_lon = last_det['centroid_lon'] + (self.u_kmh * dt_hr) / KM_PER_DEG_LON
        return pred_lat, pred_lon

    def update(self, det: Dict[str, Any], frame_idx: int):
        """Update track with new candidate detection."""
        lat, lon = det['centroid_lat'], det['centroid_lon']
        if len(self.history) > 0:
            last = self.history[-1]
            dt_frames = frame_idx - self.last_seen
            dt_hr = (dt_frames * FRAME_INTERVAL_MIN) / 60.0
            
            _, d_lon_km, d_lat_km = geo_distance_km(last['centroid_lat'], last['centroid_lon'], lat, lon)
            u_meas = d_lon_km / dt_hr
            v_meas = d_lat_km / dt_hr
            self.velocity_history.append((u_meas, v_meas))
            
            if len(self.history) == 1 and self.speed_kmh == 0.0:
                self.u_kmh = u_meas
                self.v_kmh = v_meas
            else:
                self.u_kmh = 0.7 * u_meas + 0.3 * self.u_kmh
                self.v_kmh = 0.7 * v_meas + 0.3 * self.v_kmh
                
            self.speed_kmh = float(np.sqrt(self.u_kmh**2 + self.v_kmh**2))
            bearing = np.degrees(np.arctan2(self.u_kmh, self.v_kmh))
            self.bearing_deg = float(bearing % 360.0)
            
            # Status estimation
            delta_dbz = det['max_dbz'] - last['max_dbz']
            if delta_dbz > 1.0:
                self.status = "GROWING"
            elif delta_dbz < -1.0:
                self.status = "DECAYING"
            else:
                self.status = "ACTIVE"
        else:
            self.status = "GROWING"
            
        self.last_seen = frame_idx
        self.lost_count = 0
        self.history.append(det)

    def compute_motion_stability(self) -> float:
        """
        Calculate deterministic normalized motion stability [0.0, 1.0] from recent velocity observations.
        1.0 = perfectly uniform translation; 0.0 = highly erratic trajectory.
        """
        if len(self.velocity_history) < 2:
            return 0.60 if len(self.velocity_history) == 1 else 0.35
            
        # Consider up to last 4 velocity observations
        recent = self.velocity_history[-4:]
        speeds = [float(np.hypot(u, v)) for u, v in recent]
        bearings = [float(np.degrees(np.arctan2(u, v)) % 360.0) for u, v in recent]
        
        mean_speed = float(np.mean(speeds))
        if mean_speed < 1.0:
            speed_var = 0.0
        else:
            speed_var = min(1.0, float(np.std(speeds)) / max(5.0, mean_speed))
            
        if len(bearings) >= 2:
            angle_diffs = []
            for i in range(len(bearings) - 1):
                diff = abs(bearings[i+1] - bearings[i])
                diff = min(diff, 360.0 - diff)
                angle_diffs.append(diff)
            max_angle_diff = max(angle_diffs)
            angle_var = min(1.0, max_angle_diff / 60.0)
        else:
            angle_var = 0.0
            
        instability = 0.5 * speed_var + 0.5 * angle_var
        stability = max(0.0, min(1.0, 1.0 - instability))
        return round(stability, 2)

    def get_confidence_class(self, stability: float) -> str:
        """
        Derive explainable confidence class from tracking duration and kinematic stability.
        HIGH: Established track (>=3 frames) with steady vector kinematics.
        MEDIUM: Moderately established track (>=2 frames) with acceptable stability.
        LOW: Newly initiated track (<2 frames) or erratic motion vector.
        """
        hist_len = len(self.history)
        if hist_len >= 3 and stability >= 0.70 and self.speed_kmh >= 5.0 and self.lost_count == 0:
            return "HIGH"
        elif hist_len >= 2 and stability >= 0.45:
            return "MEDIUM"
        else:
            return "LOW"

    def compute_uncertainty_km(self, horizon_min: int, stability: float) -> float:
        """
        Deterministic nowcast uncertainty radius (km).
        Uncertainty increases with forecast horizon and motion instability:
        uncertainty_km = base_uncertainty_km + horizon_factor + instability_factor + history_penalty
        NOTE: Represents kinematic divergence bounds; not a statistical probability.
        """
        base_uncertainty_km = 1.5 # Basic grid resolution & centroid quantization (~1 cell)
        horizon_factor = 0.08 * horizon_min # Linear drift growth (1.2 km at +15m, 2.4 km at +30m)
        
        horizon_weight = 1.0 if horizon_min <= 15 else 1.5
        instability_factor = 2.5 * (1.0 - stability) * horizon_weight
        history_penalty = 0.8 * max(0, 3 - len(self.history)) * horizon_weight
        
        total = base_uncertainty_km + horizon_factor + instability_factor + history_penalty
        return round(total, 1)

    def compute_projected_path(self, current_lat: float, current_lon: float) -> List[List[float]]:
        """Compute projected linear trajectory coordinates for T+15 and T+30 minutes."""
        if self.speed_kmh < 1.0:
            return [
                [round(current_lon, 6), round(current_lat, 6)],
                [round(current_lon, 6), round(current_lat, 6)],
                [round(current_lon, 6), round(current_lat, 6)]
            ]
            
        t15_lat = current_lat + (self.v_kmh * 0.25) / KM_PER_DEG_LAT
        t15_lon = current_lon + (self.u_kmh * 0.25) / KM_PER_DEG_LON
        
        t30_lat = current_lat + (self.v_kmh * 0.50) / KM_PER_DEG_LAT
        t30_lon = current_lon + (self.u_kmh * 0.50) / KM_PER_DEG_LON
        
        return [
            [round(current_lon, 6), round(current_lat, 6)],
            [round(t15_lon, 6), round(t15_lat, 6)],
            [round(t30_lon, 6), round(t30_lat, 6)]
        ]

def generate_geodesic_circle(center_lon: float, center_lat: float, radius_km: float, num_pts: int = 32) -> List[List[float]]:
    """Generate smooth polygonal ring coordinates approximating a geodesic circle around a point."""
    coords = []
    for i in range(num_pts):
        angle = (2.0 * np.pi * i) / float(num_pts)
        d_lat = (radius_km * np.cos(angle)) / KM_PER_DEG_LAT
        d_lon = (radius_km * np.sin(angle)) / KM_PER_DEG_LON
        coords.append([round(center_lon + d_lon, 6), round(center_lat + d_lat, 6)])
    coords.append(coords[0]) # Close polygon ring
    return coords

def extract_candidate_cells(frame: np.ndarray, frame_idx: int) -> List[Dict[str, Any]]:
    """Segment frame into candidate storm envelopes and sub-cell convective cores."""
    mask30 = frame >= ENVELOPE_THRESHOLD_DBZ
    labeled30, num_env = label(mask30, structure=np.ones((3,3)))
    detections: List[Dict[str, Any]] = []
    
    for env_id in range(1, num_env + 1):
        env_pixels = np.argwhere(labeled30 == env_id)
        if len(env_pixels) < MIN_CELL_PIXELS:
            continue
            
        # Inspect for intense convective cores (>= 40 dBZ) inside this envelope
        env_mask = labeled30 == env_id
        core_mask = (frame >= CORE_THRESHOLD_DBZ) & env_mask
        labeled_core, num_cores = label(core_mask, structure=np.ones((3,3)))
        
        valid_cores = []
        for cid in range(1, num_cores + 1):
            cpix = np.argwhere(labeled_core == cid)
            if len(cpix) >= MIN_CELL_PIXELS:
                weights = frame[cpix[:, 0], cpix[:, 1]]
                cy = np.sum(cpix[:, 0] * weights) / np.sum(weights)
                cx = np.sum(cpix[:, 1] * weights) / np.sum(weights)
                valid_cores.append((cy, cx, cpix))
                
        candidate_subcells = []
        if len(valid_cores) > 1:
            # Multi-cell complex: Voronoi partition envelope pixels to closest core
            core_centers = np.array([[c[0], c[1]] for c in valid_cores])
            sub_cells = [[] for _ in valid_cores]
            for py, px in env_pixels:
                dists = np.sum((core_centers - np.array([py, px]))**2, axis=1)
                best_idx = int(np.argmin(dists))
                sub_cells[best_idx].append([py, px])
                
            for cell_pix in sub_cells:
                if len(cell_pix) >= MIN_CELL_PIXELS:
                    candidate_subcells.append(np.array(cell_pix))
        else:
            candidate_subcells.append(env_pixels)
            
        for cell_pix in candidate_subcells:
            weights = frame[cell_pix[:, 0], cell_pix[:, 1]]
            cy = float(np.sum(cell_pix[:, 0] * weights) / np.sum(weights))
            cx = float(np.sum(cell_pix[:, 1] * weights) / np.sum(weights))
            lat, lon = grid_to_geo(cy, cx)
            max_dbz = float(np.max(weights))
            mean_dbz = float(np.mean(weights))
            area_km2 = float(len(cell_pix) * PIXEL_AREA_KM2)
            
            # Construct outer boundary polygon via ConvexHull
            geo_corners = []
            for py, px in cell_pix:
                for dy in [0, 1]:
                    for dx in [0, 1]:
                        c_lat = 13.1916 - ((py + dy) / float(GRID_H)) * LAT_SPAN
                        c_lon = 77.3446 + ((px + dx) / float(GRID_W)) * LON_SPAN
                        geo_corners.append([c_lon, c_lat])
            geo_corners = np.unique(geo_corners, axis=0)
            
            if len(geo_corners) >= 3:
                hull = ConvexHull(geo_corners)
                polygon_coords = [list(geo_corners[v]) for v in hull.vertices]
                polygon_coords.append(polygon_coords[0]) # Close loop
            else:
                # Fallback tiny bounding box
                polygon_coords = [
                    [lon - 0.005, lat - 0.005],
                    [lon + 0.005, lat - 0.005],
                    [lon + 0.005, lat + 0.005],
                    [lon - 0.005, lat + 0.005],
                    [lon - 0.005, lat - 0.005]
                ]
            
            detections.append({
                'cy': cy,
                'cx': cx,
                'centroid_lat': lat,
                'centroid_lon': lon,
                'area_km2': round(area_km2, 2),
                'max_dbz': round(max_dbz, 1),
                'mean_dbz': round(mean_dbz, 1),
                'intensity_class': get_intensity_class(max_dbz),
                'polygon': polygon_coords,
                'pixels': cell_pix
            })
            
    return detections

class StormTrackingEngine:
    """Manages precomputation and serving of storm cell tracking across all frames."""
    def __init__(self):
        self._lock = threading.Lock()
        self._cached_manifest: Optional[List[Dict[str, Any]]] = None

    def run_full_sequence(self, provider_or_path: Optional[Any] = None) -> List[Dict[str, Any]]:
        """Process all radar frames and generate GeoJSON FeatureCollections from canonical RadarFrames."""
        from src.services.radar_provider import get_radar_provider, RadarDataProvider, SyntheticRadarProvider
        
        if provider_or_path is None:
            provider = get_radar_provider()
        elif isinstance(provider_or_path, str):
            provider = SyntheticRadarProvider(forecast_path=provider_or_path)
        elif isinstance(provider_or_path, RadarDataProvider):
            provider = provider_or_path
        else:
            provider = get_radar_provider()
            
        frames_indices = provider.get_available_frames()
        tracks: List[StormTrack] = []
        next_track_num = 1
        manifest: List[Dict[str, Any]] = []
        
        for t in frames_indices:
            radar_frame = provider.get_frame(t)
            frame = radar_frame.get_valid_reflectivity()
            time_offset = radar_frame.relative_time_min
            detections = extract_candidate_cells(frame, t)
            
            matched_dets = set()
            matched_tracks = set()
            active_tracks = [tr for tr in tracks if tr.lost_count <= 2]
            
            if len(active_tracks) > 0 and len(detections) > 0:
                cost_matrix = []
                for tr in active_tracks:
                    pred_lat, pred_lon = tr.predict_next_pos()
                    row = []
                    for d in detections:
                        dist_km, _, _ = geo_distance_km(pred_lat, pred_lon, d['centroid_lat'], d['centroid_lon'])
                        row.append(dist_km)
                    cost_matrix.append(row)
                    
                cost_matrix = np.array(cost_matrix)
                while True:
                    min_val = np.min(cost_matrix)
                    if min_val > MAX_ASSOCIATION_GATE_KM or min_val >= 99999.0:
                        break
                    tr_idx, det_idx = np.unravel_index(np.argmin(cost_matrix), cost_matrix.shape)
                    track = active_tracks[tr_idx]
                    det = detections[det_idx]
                    track.update(det, t)
                    det['assigned_track'] = track
                    matched_tracks.add(track.track_id)
                    matched_dets.add(det_idx)
                    cost_matrix[tr_idx, :] = 999999.0
                    cost_matrix[:, det_idx] = 999999.0
                    
            for tr in active_tracks:
                if tr.track_id not in matched_tracks:
                    tr.lost_count += 1
                    
            for det_idx, det in enumerate(detections):
                if det_idx not in matched_dets:
                    new_id = f"CELL-{next_track_num:02d}"
                    next_track_num += 1
                    new_track = StormTrack(new_id, det, t)
                    tracks.append(new_track)
                    det['assigned_track'] = new_track
                    
            # Build GeoJSON features for frame t
            features: List[Dict[str, Any]] = []
            for det in detections:
                tr = det['assigned_track']
                c_lat = det['centroid_lat']
                c_lon = det['centroid_lon']
                proj_path = tr.compute_projected_path(c_lat, c_lon)
                
                # Phase 6: Deterministic stability & uncertainty metrics
                stability = tr.compute_motion_stability()
                confidence = tr.get_confidence_class(stability)
                unc_15 = tr.compute_uncertainty_km(15, stability)
                unc_30 = tr.compute_uncertainty_km(30, stability)
                
                nowcast_data = {
                    "forecast_15min": {
                        "center": proj_path[1] if len(proj_path) > 1 else [round(c_lon, 6), round(c_lat, 6)],
                        "uncertainty_km": unc_15
                    },
                    "forecast_30min": {
                        "center": proj_path[2] if len(proj_path) > 2 else [round(c_lon, 6), round(c_lat, 6)],
                        "uncertainty_km": unc_30
                    }
                }
                
                common_props = {
                    "cell_id": tr.track_id,
                    "frame_idx": t,
                    "time_offset_min": time_offset,
                    "centroid_lat": round(c_lat, 6),
                    "centroid_lon": round(c_lon, 6),
                    "area_km2": det['area_km2'],
                    "max_dbz": det['max_dbz'],
                    "mean_dbz": det['mean_dbz'],
                    "intensity_class": det['intensity_class'],
                    "motion_u_kmh": round(tr.u_kmh, 1),
                    "motion_v_kmh": round(tr.v_kmh, 1),
                    "speed_kmh": round(tr.speed_kmh, 1),
                    "bearing_deg": round(tr.bearing_deg, 1),
                    "status": tr.status,
                    "projected_path": proj_path,
                    "confidence": confidence,
                    "motion_stability": stability,
                    "nowcast": nowcast_data,
                    "synthetic_demo": True,
                    "disclaimer": "SYNTHETIC CELL TRACKING — DEMO ONLY"
                }
                
                # 1. Hull feature (Polygon)
                features.append({
                    "type": "Feature",
                    "id": f"{tr.track_id}-hull",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [det['polygon']]
                    },
                    "properties": {
                        **common_props,
                        "feature_type": "cell_hull"
                    }
                })
                
                # 2. Centroid feature (Point)
                features.append({
                    "type": "Feature",
                    "id": f"{tr.track_id}-centroid",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [round(c_lon, 6), round(c_lat, 6)]
                    },
                    "properties": {
                        **common_props,
                        "feature_type": "cell_centroid",
                        "label_text": f"{tr.track_id}\n{det['max_dbz']:.0f} dBZ · {tr.speed_kmh:.0f} km/h"
                    }
                })
                
                # 3. Vector feature (LineString for projected track)
                if len(proj_path) >= 2:
                    features.append({
                        "type": "Feature",
                        "id": f"{tr.track_id}-vector",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": proj_path
                        },
                        "properties": {
                            **common_props,
                            "feature_type": "cell_vector"
                        }
                    })
                    
                # 4. Phase 6: +15 min Uncertainty Envelope (Polygon geodesic circle)
                center_15 = nowcast_data["forecast_15min"]["center"]
                circle_15 = generate_geodesic_circle(center_15[0], center_15[1], unc_15, num_pts=32)
                features.append({
                    "type": "Feature",
                    "id": f"{tr.track_id}-uncertainty-15m",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [circle_15]
                    },
                    "properties": {
                        **common_props,
                        "feature_type": "forecast_uncertainty_15min",
                        "horizon_min": 15,
                        "uncertainty_km": unc_15
                    }
                })
                
                # 5. Phase 6: +30 min Uncertainty Envelope (Polygon geodesic circle)
                center_30 = nowcast_data["forecast_30min"]["center"]
                circle_30 = generate_geodesic_circle(center_30[0], center_30[1], unc_30, num_pts=32)
                features.append({
                    "type": "Feature",
                    "id": f"{tr.track_id}-uncertainty-30m",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [circle_30]
                    },
                    "properties": {
                        **common_props,
                        "feature_type": "forecast_uncertainty_30min",
                        "horizon_min": 30,
                        "uncertainty_km": unc_30
                    }
                })
                    
            manifest.append({
                "type": "FeatureCollection",
                "frame_idx": t,
                "time_offset_min": time_offset,
                "cell_count": len(detections),
                "features": features
            })
            
        return manifest

    def get_manifest(self, provider_or_path: Optional[Any] = None) -> List[Dict[str, Any]]:
        """Thread-safe cached manifest getter."""
        if self._cached_manifest is None:
            with self._lock:
                if self._cached_manifest is None:
                    self._cached_manifest = self.run_full_sequence(provider_or_path)
        return self._cached_manifest

    def get_frame(self, time_idx: Any = 0, provider_or_path: Optional[Any] = None) -> Dict[str, Any]:
        """
        Retrieve single frame FeatureCollection.
        Supports both modern call `get_frame(time_idx=10)` / `get_frame(10, provider)`
        and legacy positional call `get_frame(forecast_path, time_idx)`.
        """
        if isinstance(time_idx, str):
            actual_provider = time_idx
            actual_time_idx = int(provider_or_path) if provider_or_path is not None else 0
        else:
            actual_time_idx = int(time_idx)
            actual_provider = provider_or_path
            
        manifest = self.get_manifest(actual_provider)
        if 0 <= actual_time_idx < len(manifest):
            return manifest[actual_time_idx]
        return {
            "type": "FeatureCollection",
            "frame_idx": actual_time_idx,
            "time_offset_min": actual_time_idx * int(FRAME_INTERVAL_MIN),
            "cell_count": 0,
            "features": []
        }

# Global singleton engine
storm_engine = StormTrackingEngine()
