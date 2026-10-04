/**
 * VAJRA Unified API Client
 * Connects Next.js frontend pages to FastAPI backend with graceful local fallbacks.
 */

/**
 * Normalizes and sanitizes backend API URLs against common configuration typos,
 * such as accidental "NEXT_API_URL=" prefixes or duplicated protocols.
 */
export function sanitizeApiUrl(raw?: string): string {
  if (!raw) return '';
  let s = raw.trim();
  // Strip accidental key prefixes e.g. "NEXT_API_URL=" or "NEXT_PUBLIC_API_URL="
  s = s.replace(/^(NEXT_PUBLIC_API_URL|NEXT_API_URL|API_URL)\s*=\s*/i, '').trim();
  // Strip accidental outer quotes
  s = s.replace(/^["']|["']$/g, '').trim();
  // Strip accidental protocol wrapping e.g. "https://NEXT_API_URL="
  s = s.replace(/^https?:\/\/(NEXT_PUBLIC_API_URL|NEXT_API_URL|API_URL)\s*=\s*/i, '').trim();
  
  // Extract clean URL if valid protocol exists
  const match = s.match(/(https?:\/\/[^\s"'`]+)/i);
  if (match) {
    s = match[1];
  } else if (s && !s.startsWith('http://') && !s.startsWith('https://')) {
    s = `https://${s}`;
  }
  return s.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      const pub = sanitizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
      if (pub && !pub.includes('localhost') && !pub.includes('127.0.0.1')) {
        return pub;
      }
      return 'https://vajra-production-aad1.up.railway.app';
    }
  }
  const raw = sanitizeApiUrl(process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL);
  if (raw) return raw;
  return 'http://localhost:8000';
}

// =============================================================================
// 1. DISASTER OPERATIONS & CIVIL DEFENSE
// =============================================================================
export interface WardData {
  id: string;
  name: string;
  risk: number;
  level: string;
  rainRate: string;
  floodDepth: string;
  underpasses: string;
  pumps: string;
  pumpsActive?: number;
  pumpsTotal?: number;
  siren: string;
}

export interface InfrastructureAsset {
  name: string;
  type: string;
  status: string;
  impact: string;
}

export async function fetchDisasterWards(): Promise<WardData[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/disaster-ops/wards`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.wards;
  } catch (err) {
    console.warn('Backend unavailable, using local disaster wards fallback:', err);
    return [
      { id: 'ward-150', name: 'Bellandur (Ward 150)', risk: 92, level: 'Critical', rainRate: '78 mm/hr', floodDepth: '1.4 m', underpasses: 'Waterlogged', pumps: '5/6 Active', pumpsActive: 5, pumpsTotal: 6, siren: 'Armed' },
      { id: 'ward-174', name: 'Silk Board Junction (Ward 174)', risk: 88, level: 'Critical', rainRate: '65 mm/hr', floodDepth: '1.1 m', underpasses: 'Diverted', pumps: '4/4 Active', pumpsActive: 4, pumpsTotal: 4, siren: 'Armed' },
      { id: 'ward-151', name: 'Koramangala 4th Block (Ward 151)', risk: 79, level: 'High', rainRate: '54 mm/hr', floodDepth: '0.8 m', underpasses: 'Slowed', pumps: '3/3 Active', pumpsActive: 3, pumpsTotal: 3, siren: 'Standby' },
      { id: 'ward-007', name: 'Hebbal Flyover Corridor (Ward 7)', risk: 74, level: 'High', rainRate: '48 mm/hr', floodDepth: '0.6 m', underpasses: 'Clear', pumps: '2/2 Active', pumpsActive: 2, pumpsTotal: 2, siren: 'Standby' },
      { id: 'ward-085', name: 'Whitefield - ITPL Corridor (Ward 85)', risk: 58, level: 'Moderate', rainRate: '32 mm/hr', floodDepth: '0.3 m', underpasses: 'Clear', pumps: '1/2 Active', pumpsActive: 1, pumpsTotal: 2, siren: 'Standby' },
      { id: 'ward-003', name: 'Yelahanka Lake Basin (Ward 3)', risk: 36, level: 'Low', rainRate: '19 mm/hr', floodDepth: '0.1 m', underpasses: 'Clear', pumps: '0/1 Active', pumpsActive: 0, pumpsTotal: 1, siren: 'Standby' },
    ];
  }
}

export async function fetchInfrastructure(): Promise<InfrastructureAsset[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/disaster-ops/infrastructure`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.assets;
  } catch (err) {
    console.warn('Backend unavailable, using local infrastructure fallback:', err);
    return [
      { name: 'Namma Metro Purple Line', type: 'Transit', status: 'Operational', impact: 'Track sensors nominal; 0.2m runoff at Indiranagar station sump' },
      { name: 'Kempegowda Airport Expressway (NH44)', type: 'Highway', status: 'Hydroplane Alert', impact: 'Speed reduced to 50 km/h between Yelahanka & Devanahalli' },
      { name: 'BESCOM 66kV Substation (Koramangala)', type: 'Power Grid', status: 'Pump Active', impact: 'Automated flood barrier deployed; 0.4m below critical busbar' },
      { name: 'Victoria & Bowring Hospital Access', type: 'Healthcare', status: 'Priority Corridor', impact: 'Designated alternate emergency routes active via MG Road' }
    ];
  }
}

export async function toggleWardPump(wardId: string): Promise<WardData | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/disaster-ops/pumps/${wardId}/toggle`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.ward;
  } catch (err) {
    console.warn('Backend pump toggle failed, handling locally:', err);
    return null;
  }
}

export async function fetchCapXml(rainRate: string = '78 mm/hr'): Promise<string> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/disaster-ops/cap-alert?rainRate=${encodeURIComponent(rainRate)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.xml;
  } catch (err) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>VAJRA-NOWCAST-${new Date().toISOString().slice(0, 10)}-004</identifier>
  <sender>imd-nowcast@vajra.gov.in</sender>
  <sent>${new Date().toISOString()}</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>Severe Thunderstorm & Flash Flood</event>
    <urgency>Immediate</urgency>
    <severity>Severe</severity>
    <certainty>Observed</certainty>
    <headline>Level 4 Convective Deluge & Microburst Expected over Central Bengaluru</headline>
    <description>Doppler radar echo >65 dBZ detected with cyclonic velocity signature. Rainfall exceeding ${rainRate} in Bellandur & Silk Board sectors within 25 minutes.</description>
    <area>
      <areaDesc>Bengaluru Urban (BBMP East & South Zones)</areaDesc>
      <circle>12.9716,77.5946,18.0</circle>
    </area>
  </info>
</alert>`;
  }
}

export async function dispatchAlertBroadcast(payload: any = {}): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/disaster-ops/dispatch-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend dispatch failed, handling gracefully:', err);
    return { status: 'dispatched', message: 'Local simulation alert dispatched' };
  }
}

// =============================================================================
// 2. AVIATION TERMINAL WEATHER
// =============================================================================
export async function fetchAviationAirports(): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/aviation/airports`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.airports;
  } catch (err) {
    console.warn('Backend aviation endpoint failed, falling back:', err);
    return {};
  }
}

// =============================================================================
// 3. THERMODYNAMICS & SOUNDINGS
// =============================================================================
export async function fetchSoundingProfile(stationId: string): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/thermodynamics/sounding/${stationId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.profile;
  } catch (err) {
    console.warn('Backend sounding endpoint failed:', err);
    return [];
  }
}

export async function fetchStationIndices(stationId: string): Promise<any[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/thermodynamics/indices/${stationId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.indices;
  } catch (err) {
    console.warn('Backend indices endpoint failed:', err);
    return [];
  }
}

// =============================================================================
// 4. REPLAY & CASE STUDIES
// =============================================================================
export async function fetchReplayCase(caseId: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/replay/${caseId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.case;
  } catch (err) {
    console.warn('Backend replay endpoint failed:', err);
    return null;
  }
}

// =============================================================================
// 5. VALIDATION ANALYTICS
// =============================================================================
export async function fetchAnalyticsData(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/analytics/benchmarks`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend analytics endpoint failed:', err);
    return null;
  }
}

// =============================================================================
// 6. MODEL ARCHITECTURE & XAI
// =============================================================================
export async function fetchModelsInfo(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/models/info`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend model info endpoint failed:', err);
    return null;
  }
}

// =============================================================================
// 7. RADAR METADATA & PROVIDER DISCLOSURE (PHASE 7)
// =============================================================================
export interface RadarMetadata {
  source_type: string;
  source_id: string;
  provider_class: string;
  synthetic_demo: boolean;
  status_disclosure: string;
  disclaimer: string;
  frame_count: number;
  interval_minutes: number;
  temporal_range: {
    start_offset_min: number;
    end_offset_min: number;
    timestamp_utc?: string;
    timestamps_utc?: string[];
  };

  grid: {
    width: number;
    height: number;
  };
  units: string;
  valid_range: {
    min_dbz: number;
    max_dbz: number;
  };
  nodata_value: number;
  bounds: [number, number][];
  spatial_resolution_km: {
    dx: number;
    dy: number;
  };
}

export async function fetchRadarMetadata(): Promise<RadarMetadata | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/radar/metadata`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, using default synthetic radar metadata fallback:', err);
    return {
      source_type: 'synthetic',
      source_id: 'latest_forecast.npy',
      provider_class: 'SyntheticRadarProvider',
      synthetic_demo: true,
      status_disclosure: 'SYNTHETIC DATA — DEMO ONLY',
      disclaimer: 'Synthetic procedural Gaussian advection model. Not real observational radar.',
      frame_count: 18,
      interval_minutes: 5,
      temporal_range: {
        start_offset_min: 0,
        end_offset_min: 85
      },
      grid: {
        width: 40,
        height: 40
      },
      units: 'dBZ',
      valid_range: {
        min_dbz: 0.0,
        max_dbz: 65.0
      },
      nodata_value: -9999.0,
      bounds: [
        [77.3446, 13.1916],
        [77.8446, 13.1916],
        [77.8446, 12.7516],
        [77.3446, 12.7516]
      ],
      spatial_resolution_km: {
        dx: 1.3585,
        dy: 1.2170
      }
    };
  }
}

