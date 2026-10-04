"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type mapboxgl from 'mapbox-gl';
import { 
  Search, AlertTriangle, Wind, Droplets, Activity, Settings, Clock, 
  CloudLightning, Terminal, Play, Pause, SkipBack, SkipForward, 
  BarChart2, Cpu, ShieldAlert, RotateCcw, Thermometer, Plane,
  MapPin, ZoomIn, ZoomOut, Compass, Navigation
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import Link from 'next/link';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import VajraMap from '@/components/map/VajraMap';
import MapControls from '@/components/map/MapControls';
import MapLegend from '@/components/map/MapLegend';
import { BENGALURU_RADAR_BOUNDS, RADAR_LAYER_ID, RADAR_SOURCE_ID } from '@/lib/mapbox';
import { fetchRadarMetadata, RadarMetadata, getApiBaseUrl } from '@/lib/api';

export interface CityWeatherItem {
  id: string;
  name: string;
  state: string;
  coordinates: [number, number]; // [lon, lat]
  temp: number;
  humidity: number;
  wind: number;
  aqi: number;
  cape: number;
  windShear: number;
  rainRate: string;
  threat: 'Critical' | 'Severe' | 'Moderate' | 'Low' | 'Clear';
  dangerLevel: 'DANGER' | 'WARNING' | 'SAFE';
  statusClass: 'status-danger' | 'status-warning' | 'status-safe';
  color: string;
  minZoom: number; // min zoom to show sublabel on map
  point1: string;
  point2: string;
  radarEcho: string;
  alerts: Array<{ title: string; level?: string; confidence?: number; eta?: number; desc?: string }>;
  precipitation: Array<{ time: string; amount: number; confidence: number }>;
}

export const CITIES_DATA: CityWeatherItem[] = [
  // Local Metropolitan Bengaluru Localities (From Screenshot: Mahadevapura, Indiranagar, etc.)
  {
    id: 'mahadevapura',
    name: 'Mahadevapura',
    state: 'Bengaluru East',
    coordinates: [77.6953, 12.9918],
    temp: 27.2,
    humidity: 86,
    wind: 32,
    aqi: 60,
    cape: 1780,
    windShear: 36,
    rainRate: '72 mm/hr',
    threat: 'Critical',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 9.5,
    point1: 'Peak Convective Core: 72 mm/hr deluge over Ring Road corridor',
    point2: 'Flash Inundation Warning: Low-lying rail underpass waterlogged',
    radarEcho: '66 dBZ Deluge',
    alerts: [
      { title: 'Extreme Convective Core Over Mahadevapura', level: 'Level 4 Critical Red', confidence: 97, eta: 5 },
      { title: 'Rail Underpass Flooding', desc: 'Avoid Outer Ring Road low-lying bridges' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 5, confidence: 100 },
      { time: 'T-15m', amount: 24, confidence: 100 },
      { time: 'NOW', amount: 58, confidence: 98 },
      { time: 'T+15m', amount: 72, confidence: 96 },
      { time: 'T+30m', amount: 50, confidence: 90 },
      { time: 'T+45m', amount: 25, confidence: 78 },
      { time: 'T+60m', amount: 8, confidence: 60 },
    ]
  },
  {
    id: 'indiranagar',
    name: 'Indiranagar',
    state: 'Bengaluru East',
    coordinates: [77.6412, 12.9784],
    temp: 27.0,
    humidity: 84,
    wind: 28,
    aqi: 56,
    cape: 1650,
    windShear: 32,
    rainRate: '64 mm/hr',
    threat: 'Severe',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 9.5,
    point1: '100ft Road Inundation: 0.8m runoff pooling at 12th Main junction',
    point2: 'Storm Sump Telemetry: 3/3 municipal pumps active on standby',
    radarEcho: '62 dBZ Squall',
    alerts: [
      { title: 'Severe Rain Surge in Indiranagar', level: 'Level 3 Severe', confidence: 94, eta: 10 },
      { title: 'Surface Runoff Advisory', desc: 'Road ponding active; vehicle transit slowed' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 2, confidence: 100 },
      { time: 'T-15m', amount: 16, confidence: 100 },
      { time: 'NOW', amount: 48, confidence: 96 },
      { time: 'T+15m', amount: 64, confidence: 94 },
      { time: 'T+30m', amount: 42, confidence: 86 },
      { time: 'T+45m', amount: 20, confidence: 72 },
      { time: 'T+60m', amount: 6, confidence: 58 },
    ]
  },
  {
    id: 'koramangala',
    name: 'Koramangala (Ward 151)',
    state: 'Bengaluru South',
    coordinates: [77.6245, 12.9352],
    temp: 27.3,
    humidity: 85,
    wind: 26,
    aqi: 54,
    cape: 1710,
    windShear: 30,
    rainRate: '54 mm/hr',
    threat: 'Severe',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 9.5,
    point1: '4th Block Storm Drain: Inflow nearing 82% sluice gate capacity',
    point2: 'BESCOM Substation Barrier: Automated flood barrier deployed',
    radarEcho: '58 dBZ Cell',
    alerts: [
      { title: 'Storm Drain Sluice Armed', level: 'Level 3 Severe', confidence: 92, eta: 12 },
      { title: '4th Block Waterlogging Alert', desc: 'Drainage pumps activated at Sony World junction' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 12, confidence: 100 },
      { time: 'NOW', amount: 42, confidence: 96 },
      { time: 'T+15m', amount: 54, confidence: 92 },
      { time: 'T+30m', amount: 36, confidence: 84 },
      { time: 'T+45m', amount: 16, confidence: 70 },
      { time: 'T+60m', amount: 4, confidence: 55 },
    ]
  },
  {
    id: 'marathahalli',
    name: 'Marathahalli',
    state: 'Bengaluru East',
    coordinates: [77.7011, 12.9591],
    temp: 27.1,
    humidity: 87,
    wind: 30,
    aqi: 58,
    cape: 1690,
    windShear: 34,
    rainRate: '68 mm/hr',
    threat: 'Critical',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 9.5,
    point1: 'ORR Underpass Submerged: 1.2m flood depth; traffic diverted',
    point2: 'Convective Cell Vortex: Gust front wind shear 34 kt measured',
    radarEcho: '64 dBZ Core',
    alerts: [
      { title: 'Underpass Submerged Alert', level: 'Level 4 Critical Red', confidence: 96, eta: 7 },
      { title: 'ORR Multiplex Junction Flooded', desc: 'Emergency traffic diversions active' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 4, confidence: 100 },
      { time: 'T-15m', amount: 22, confidence: 100 },
      { time: 'NOW', amount: 54, confidence: 98 },
      { time: 'T+15m', amount: 68, confidence: 95 },
      { time: 'T+30m', amount: 46, confidence: 88 },
      { time: 'T+45m', amount: 22, confidence: 76 },
      { time: 'T+60m', amount: 6, confidence: 60 },
    ]
  },
  {
    id: 'bellandur',
    name: 'Bellandur (Ward 150)',
    state: 'Bengaluru Urban',
    coordinates: [77.6762, 12.9298],
    temp: 26.8,
    humidity: 89,
    wind: 32,
    aqi: 52,
    cape: 1850,
    windShear: 38,
    rainRate: '78 mm/hr',
    threat: 'Critical',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 9.5,
    point1: 'Peak Inundation: 1.4m runoff at ORR underpass',
    point2: 'Drainage Action: 5/6 automated flood pumps active',
    radarEcho: '68 dBZ Deluge',
    alerts: [
      { title: 'Critical Inundation Alert', level: 'Level 4 Critical Red', confidence: 98, eta: 5 },
      { title: 'Underpass Submerged', desc: 'Outer Ring Road traffic diverted via Sarjapur corridor' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 5, confidence: 100 },
      { time: 'T-15m', amount: 28, confidence: 100 },
      { time: 'NOW', amount: 62, confidence: 98 },
      { time: 'T+15m', amount: 78, confidence: 96 },
      { time: 'T+30m', amount: 55, confidence: 90 },
      { time: 'T+45m', amount: 30, confidence: 80 },
      { time: 'T+60m', amount: 12, confidence: 65 },
    ]
  },
  {
    id: 'silk-board',
    name: 'Silk Board (Ward 174)',
    state: 'Bengaluru Urban',
    coordinates: [77.6229, 12.9172],
    temp: 27.0,
    humidity: 87,
    wind: 30,
    aqi: 58,
    cape: 1720,
    windShear: 34,
    rainRate: '65 mm/hr',
    threat: 'Critical',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 9.5,
    point1: 'Underpass Waterlogged: 1.1m depth; vehicles diverted',
    point2: 'Runoff Convergence: Madiwala lake overflow armed',
    radarEcho: '64 dBZ Vortex',
    alerts: [
      { title: 'Traffic Junction Inundation', level: 'Level 4 Critical Red', confidence: 96, eta: 8 },
      { title: '4/4 Pump Stations Armed', desc: 'Hosur Road underpass closed to two-wheelers' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 4, confidence: 100 },
      { time: 'T-15m', amount: 20, confidence: 100 },
      { time: 'NOW', amount: 50, confidence: 98 },
      { time: 'T+15m', amount: 65, confidence: 94 },
      { time: 'T+30m', amount: 45, confidence: 88 },
      { time: 'T+45m', amount: 22, confidence: 75 },
      { time: 'T+60m', amount: 8, confidence: 60 },
    ]
  },
  {
    id: 'whitefield',
    name: 'Whitefield - ITPL',
    state: 'Bengaluru East',
    coordinates: [77.7499, 12.9698],
    temp: 28.0,
    humidity: 75,
    wind: 22,
    aqi: 60,
    cape: 1280,
    windShear: 26,
    rainRate: '32 mm/hr',
    threat: 'Moderate',
    dangerLevel: 'WARNING',
    statusClass: 'status-warning',
    color: '#f59e0b',
    minZoom: 9.5,
    point1: 'Downwind Cloud Shield: Light 32 mm/hr rainband',
    point2: 'Transit Corridor: Metro Purple Line operating nominal',
    radarEcho: '44 dBZ Moderate',
    alerts: [
      { title: 'Moderate Cloud Shield', level: 'Level 2 Moderate', confidence: 85, eta: 25 },
      { title: 'Transit Sump Nominal', desc: 'No critical underpass waterlogging detected' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 4, confidence: 100 },
      { time: 'NOW', amount: 14, confidence: 92 },
      { time: 'T+15m', amount: 32, confidence: 90 },
      { time: 'T+30m', amount: 24, confidence: 80 },
      { time: 'T+45m', amount: 10, confidence: 70 },
      { time: 'T+60m', amount: 2, confidence: 55 },
    ]
  },
  {
    id: 'hebbal',
    name: 'Hebbal Flyover (Ward 7)',
    state: 'Bengaluru North',
    coordinates: [77.5970, 13.0358],
    temp: 27.4,
    humidity: 80,
    wind: 26,
    aqi: 66,
    cape: 1540,
    windShear: 30,
    rainRate: '48 mm/hr',
    threat: 'Severe',
    dangerLevel: 'WARNING',
    statusClass: 'status-warning',
    color: '#f59e0b',
    minZoom: 9.5,
    point1: 'Flyover Inflow: 48 mm/hr cell passing northwards',
    point2: 'Storm Drain Level: 0.6m runoff; pumps on standby',
    radarEcho: '56 dBZ Squall',
    alerts: [
      { title: 'Airport Expressway Alert', level: 'Level 3 Severe', confidence: 90, eta: 15 },
      { title: 'Hydroplane Advisory', desc: 'Speed limit advisory 50 km/h on NH44 elevated corridor' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 12, confidence: 100 },
      { time: 'NOW', amount: 38, confidence: 96 },
      { time: 'T+15m', amount: 48, confidence: 92 },
      { time: 'T+30m', amount: 30, confidence: 82 },
      { time: 'T+45m', amount: 12, confidence: 70 },
      { time: 'T+60m', amount: 3, confidence: 58 },
    ]
  },
  {
    id: 'yelahanka',
    name: 'Yelahanka Basin',
    state: 'Bengaluru North',
    coordinates: [77.5963, 13.1007],
    temp: 28.4,
    humidity: 72,
    wind: 18,
    aqi: 50,
    cape: 980,
    windShear: 18,
    rainRate: '14 mm/hr',
    threat: 'Low',
    dangerLevel: 'SAFE',
    statusClass: 'status-safe',
    color: '#10b981',
    minZoom: 9.5,
    point1: 'Clear Lake Basin: Moderate stratiform shower passed',
    point2: 'Inundation Status: Lake overflow sluices at 45% nominal',
    radarEcho: '30 dBZ Light Rain',
    alerts: [
      { title: 'Conditions Nominal', level: 'Level 1 Safe', confidence: 95, eta: 0 },
      { title: 'No Threat Active', desc: 'Storm core diverted southeast of Yelahanka' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 2, confidence: 100 },
      { time: 'NOW', amount: 8, confidence: 95 },
      { time: 'T+15m', amount: 14, confidence: 90 },
      { time: 'T+30m', amount: 6, confidence: 80 },
      { time: 'T+45m', amount: 0, confidence: 70 },
      { time: 'T+60m', amount: 0, confidence: 60 },
    ]
  },
  {
    id: 'peenya',
    name: 'Peenya Industrial',
    state: 'Bengaluru West',
    coordinates: [77.5273, 13.0285],
    temp: 28.6,
    humidity: 70,
    wind: 16,
    aqi: 68,
    cape: 920,
    windShear: 16,
    rainRate: '8 mm/hr',
    threat: 'Low',
    dangerLevel: 'SAFE',
    statusClass: 'status-safe',
    color: '#10b981',
    minZoom: 9.5,
    point1: 'Industrial Corridor: Dry boundary layer; light sprinkles',
    point2: 'Transit Clear: Tumkur Road flyover unobstructed',
    radarEcho: '24 dBZ Virga',
    alerts: [
      { title: 'Minimal Weather Impact', level: 'Level 1 Safe', confidence: 98, eta: 0 },
      { title: 'All Roads Passable', desc: 'No convective storms over Western industrial belt' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 0, confidence: 100 },
      { time: 'NOW', amount: 4, confidence: 95 },
      { time: 'T+15m', amount: 8, confidence: 90 },
      { time: 'T+30m', amount: 2, confidence: 80 },
      { time: 'T+45m', amount: 0, confidence: 70 },
      { time: 'T+60m', amount: 0, confidence: 60 },
    ]
  },
  {
    id: 'jp-nagar',
    name: 'J. P. Nagar',
    state: 'Bengaluru South',
    coordinates: [77.5855, 12.9063],
    temp: 28.5,
    humidity: 74,
    wind: 19,
    aqi: 56,
    cape: 1050,
    windShear: 20,
    rainRate: '18 mm/hr',
    threat: 'Low',
    dangerLevel: 'SAFE',
    statusClass: 'status-safe',
    color: '#10b981',
    minZoom: 9.5,
    point1: 'Moderate Scattered Showers: Inflow rate 18 mm/hr nominal',
    point2: 'Local Underpass: Clear of standing flood water',
    radarEcho: '32 dBZ Showers',
    alerts: [
      { title: 'Scattered Showers Only', level: 'Level 1 Safe', confidence: 92, eta: 0 },
      { title: 'Normal Conditions', desc: 'Storm core situated 8km northeast' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 4, confidence: 100 },
      { time: 'NOW', amount: 10, confidence: 95 },
      { time: 'T+15m', amount: 18, confidence: 90 },
      { time: 'T+30m', amount: 12, confidence: 82 },
      { time: 'T+45m', amount: 4, confidence: 70 },
      { time: 'T+60m', amount: 0, confidence: 60 },
    ]
  },
  {
    id: 'electronic-city',
    name: 'Electronic City',
    state: 'Bengaluru South',
    coordinates: [77.6749, 12.8399],
    temp: 28.8,
    humidity: 68,
    wind: 16,
    aqi: 54,
    cape: 890,
    windShear: 15,
    rainRate: '6 mm/hr',
    threat: 'Low',
    dangerLevel: 'SAFE',
    statusClass: 'status-safe',
    color: '#10b981',
    minZoom: 9.5,
    point1: 'Dry Boundary Air: Elevated expressway completely dry',
    point2: 'No Waterlogging: Transit corridors fully operational',
    radarEcho: '18 dBZ Clear',
    alerts: [
      { title: 'Clear Corridor', level: 'Level 1 Safe', confidence: 99, eta: 0 },
      { title: 'Nominal Operations', desc: 'No rain forecasted for next 60 minutes' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 0, confidence: 100 },
      { time: 'NOW', amount: 0, confidence: 98 },
      { time: 'T+15m', amount: 6, confidence: 90 },
      { time: 'T+30m', amount: 4, confidence: 80 },
      { time: 'T+45m', amount: 0, confidence: 70 },
      { time: 'T+60m', amount: 0, confidence: 60 },
    ]
  },
  {
    id: 'vobl-airport',
    name: 'Kempegowda Int Airport (VOBL)',
    state: 'Bengaluru Aviation',
    coordinates: [77.7064, 13.1986],
    temp: 26.5,
    humidity: 84,
    wind: 38,
    aqi: 48,
    cape: 1920,
    windShear: 42,
    rainRate: '60 mm/hr',
    threat: 'Severe',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 9.0,
    point1: 'Runway Microburst: -18 kt shear alert on 3nm final',
    point2: 'ATC Go-Around: Crosswind 21 kt gusting to 38 kt',
    radarEcho: '62 dBZ Microburst',
    alerts: [
      { title: 'Runway Wind Shear Go-Around', level: 'Level 3 Severe', confidence: 96, eta: 6 },
      { title: 'Diversion Advisory 58%', desc: 'Inbound arrivals holding at BIA VOR corridor' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 2, confidence: 100 },
      { time: 'T-15m', amount: 18, confidence: 100 },
      { time: 'NOW', amount: 46, confidence: 96 },
      { time: 'T+15m', amount: 60, confidence: 94 },
      { time: 'T+30m', amount: 40, confidence: 86 },
      { time: 'T+45m', amount: 18, confidence: 72 },
      { time: 'T+60m', amount: 4, confidence: 55 },
    ]
  },
  // Major Indian Cities (Visible at Lower / Regional Zoom)
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    coordinates: [77.5946, 12.9716],
    temp: 27.7,
    humidity: 76,
    wind: 28,
    aqi: 65,
    cape: 1430,
    windShear: 32,
    rainRate: '78 mm/hr',
    threat: 'Severe',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 3.5,
    point1: 'Convective Core: 68 dBZ (Vortex approaching from NW)',
    point2: 'Severe Flood: Bellandur & Silk Board on Level 4 Red',
    radarEcho: '68 dBZ Supercell',
    alerts: [
      { title: 'Tornadic Vortex Signature', level: 'Level 3 Severe', confidence: 94, eta: 18 },
      { title: 'Precipitation Surge', desc: '+42mm/hr expected in Sector 4 (Approaching from NW)' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 4, confidence: 100 },
      { time: 'NOW', amount: 22, confidence: 100 },
      { time: 'T+15m', amount: 58, confidence: 96 },
      { time: 'T+30m', amount: 42, confidence: 88 },
      { time: 'T+45m', amount: 18, confidence: 74 },
      { time: 'T+60m', amount: 4, confidence: 60 },
    ]
  },
  {
    id: 'delhi',
    name: 'Delhi-NCR',
    state: 'National Capital Region',
    coordinates: [77.2090, 28.6139],
    temp: 33.5,
    humidity: 62,
    wind: 38,
    aqi: 142,
    cape: 1200,
    windShear: 28,
    rainRate: '35 mm/hr',
    threat: 'Moderate',
    dangerLevel: 'WARNING',
    statusClass: 'status-warning',
    color: '#f59e0b',
    minZoom: 3.5,
    point1: 'Squall Line Front: 42 kt gust front approaching IGI Airport',
    point2: 'Thermal Cap (-65 J/kg CIN): Severe hail potential if broken',
    radarEcho: '48 dBZ Multi-cell',
    alerts: [
      { title: 'Dust Squall & Wind Shear Advisory', level: 'Level 2 Moderate', confidence: 85, eta: 25 },
      { title: 'Runway Visibility Alert', desc: 'Crosswind 26 kt with blowing dust at VIDP' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 0, confidence: 100 },
      { time: 'NOW', amount: 8, confidence: 95 },
      { time: 'T+15m', amount: 26, confidence: 90 },
      { time: 'T+30m', amount: 35, confidence: 80 },
      { time: 'T+45m', amount: 14, confidence: 70 },
      { time: 'T+60m', amount: 2, confidence: 60 },
    ]
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    coordinates: [72.8777, 19.0760],
    temp: 29.8,
    humidity: 88,
    wind: 34,
    aqi: 58,
    cape: 2400,
    windShear: 35,
    rainRate: '86 mm/hr',
    threat: 'Critical',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#dc2626',
    minZoom: 3.5,
    point1: 'Monsoon Rainband: Torrential deluge exceeding 86 mm/hr',
    point2: 'High Tide Warning: Storm runoff backed up along Mithi River',
    radarEcho: '72 dBZ Convective Cluster',
    alerts: [
      { title: 'High Tide Convective Surge', level: 'Level 4 Critical Red', confidence: 98, eta: 10 },
      { title: 'Urban Flash Inundation', desc: 'Central & Western transit lines face hydroplane risk' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 15, confidence: 100 },
      { time: 'T-15m', amount: 38, confidence: 100 },
      { time: 'NOW', amount: 72, confidence: 98 },
      { time: 'T+15m', amount: 86, confidence: 95 },
      { time: 'T+30m', amount: 64, confidence: 90 },
      { time: 'T+45m', amount: 40, confidence: 80 },
      { time: 'T+60m', amount: 25, confidence: 70 },
    ]
  },
  {
    id: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    coordinates: [80.2707, 13.0827],
    temp: 31.2,
    humidity: 82,
    wind: 26,
    aqi: 62,
    cape: 1850,
    windShear: 24,
    rainRate: '48 mm/hr',
    threat: 'Moderate',
    dangerLevel: 'WARNING',
    statusClass: 'status-warning',
    color: '#f59e0b',
    minZoom: 4.0,
    point1: 'Bay of Bengal Inflow: Deep moisture column (58.2mm PWAT)',
    point2: 'Basin Sluice Alert: Coastal storm drains armed at 85% capacity',
    radarEcho: '54 dBZ Rainband',
    alerts: [
      { title: 'Coastal Convergence Inflow', level: 'Level 2 Moderate', confidence: 88, eta: 30 },
      { title: 'Low-Lying Sump Alert', desc: 'Velachery & Adyar flood basins on standby' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 2, confidence: 100 },
      { time: 'T-15m', amount: 10, confidence: 100 },
      { time: 'NOW', amount: 28, confidence: 95 },
      { time: 'T+15m', amount: 48, confidence: 90 },
      { time: 'T+30m', amount: 36, confidence: 82 },
      { time: 'T+45m', amount: 16, confidence: 72 },
      { time: 'T+60m', amount: 5, confidence: 60 },
    ]
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    state: 'West Bengal',
    coordinates: [88.3639, 22.5726],
    temp: 30.4,
    humidity: 85,
    wind: 30,
    aqi: 74,
    cape: 2100,
    windShear: 31,
    rainRate: '62 mm/hr',
    threat: 'Severe',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 4.0,
    point1: "Nor'wester Squall: Multi-cell thunderstorm tracking SE at 45 km/h",
    point2: 'Lightning Surge: Extreme cloud-to-ground flash rate (16/min)',
    radarEcho: '64 dBZ Norwester',
    alerts: [
      { title: 'Kalbaishakhi Thunderstorm Warning', level: 'Level 3 Severe', confidence: 92, eta: 15 },
      { title: 'Gale Inflow Alert', desc: 'Gusts up to 65 km/h expected across Hooghly basin' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 8, confidence: 100 },
      { time: 'NOW', amount: 34, confidence: 96 },
      { time: 'T+15m', amount: 62, confidence: 94 },
      { time: 'T+30m', amount: 48, confidence: 85 },
      { time: 'T+45m', amount: 20, confidence: 70 },
      { time: 'T+60m', amount: 6, confidence: 55 },
    ]
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    coordinates: [78.4867, 17.3850],
    temp: 31.8,
    humidity: 70,
    wind: 22,
    aqi: 82,
    cape: 1350,
    windShear: 25,
    rainRate: '42 mm/hr',
    threat: 'Moderate',
    dangerLevel: 'WARNING',
    statusClass: 'status-warning',
    color: '#f59e0b',
    minZoom: 4.0,
    point1: 'Isolated Convective Cell: 52 dBZ radar echo over Hitec City',
    point2: 'Microburst Risk: Downdraft shear -14 kt on runway approach',
    radarEcho: '52 dBZ Cell',
    alerts: [
      { title: 'Convective Cell Advisory', level: 'Level 2 Moderate', confidence: 82, eta: 35 },
      { title: 'Underpass Sump Alert', desc: 'Begumpet and Gachibowli drainage units activated' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 2, confidence: 100 },
      { time: 'NOW', amount: 16, confidence: 90 },
      { time: 'T+15m', amount: 42, confidence: 86 },
      { time: 'T+30m', amount: 30, confidence: 78 },
      { time: 'T+45m', amount: 12, confidence: 65 },
      { time: 'T+60m', amount: 0, confidence: 50 },
    ]
  },
  {
    id: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    coordinates: [73.8567, 18.5204],
    temp: 28.1,
    humidity: 79,
    wind: 20,
    aqi: 54,
    cape: 1100,
    windShear: 22,
    rainRate: '28 mm/hr',
    threat: 'Low',
    dangerLevel: 'SAFE',
    statusClass: 'status-safe',
    color: '#10b981',
    minZoom: 4.5,
    point1: 'Ghats Orographic Uplift: Rainbands drifting east towards city basin',
    point2: 'River Catchment: Mutha spillway inflow nominal (+0.4m depth)',
    radarEcho: '38 dBZ Stratiform',
    alerts: [
      { title: 'Orographic Shower Alert', level: 'Level 1 Safe', confidence: 78, eta: 40 },
      { title: 'Surface Runoff Advisory', desc: 'Mild ponding observed near Shivaji Nagar' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 5, confidence: 100 },
      { time: 'NOW', amount: 18, confidence: 95 },
      { time: 'T+15m', amount: 28, confidence: 88 },
      { time: 'T+30m', amount: 20, confidence: 80 },
      { time: 'T+45m', amount: 10, confidence: 70 },
      { time: 'T+60m', amount: 2, confidence: 60 },
    ]
  },
  {
    id: 'ahmedabad',
    name: 'Ahmedabad',
    state: 'Gujarat',
    coordinates: [72.5714, 23.0225],
    temp: 35.0,
    humidity: 54,
    wind: 18,
    aqi: 110,
    cape: 850,
    windShear: 18,
    rainRate: '12 mm/hr',
    threat: 'Low',
    dangerLevel: 'SAFE',
    statusClass: 'status-safe',
    color: '#10b981',
    minZoom: 4.5,
    point1: 'High LCL Cloud Base (1.8km): Sub-cloud virga evaporating rain',
    point2: 'Thermal Boundary: Dust suspension with visibility at 3.5 km',
    radarEcho: '28 dBZ Dry Echo',
    alerts: [
      { title: 'Dry Thermal Boundary Layer', level: 'Level 1 Safe', confidence: 70, eta: 50 },
      { title: 'Particulate Suspension', desc: 'AQI elevated; no severe flash flooding expected' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 0, confidence: 100 },
      { time: 'T-15m', amount: 0, confidence: 100 },
      { time: 'NOW', amount: 2, confidence: 85 },
      { time: 'T+15m', amount: 12, confidence: 80 },
      { time: 'T+30m', amount: 8, confidence: 70 },
      { time: 'T+45m', amount: 2, confidence: 60 },
      { time: 'T+60m', amount: 0, confidence: 50 },
    ]
  },
  {
    id: 'kochi',
    name: 'Kochi',
    state: 'Kerala',
    coordinates: [76.2673, 9.9312],
    temp: 28.6,
    humidity: 91,
    wind: 24,
    aqi: 42,
    cape: 1650,
    windShear: 26,
    rainRate: '54 mm/hr',
    threat: 'Moderate',
    dangerLevel: 'WARNING',
    statusClass: 'status-warning',
    color: '#f59e0b',
    minZoom: 4.5,
    point1: 'Arabian Sea Plume: Heavy tropical warm rain process active',
    point2: 'Periyar Basin: Hydrological runoff alert level 1 engaged',
    radarEcho: '56 dBZ Oceanic Cell',
    alerts: [
      { title: 'Coastal Squall Warning', level: 'Level 2 Moderate', confidence: 89, eta: 20 },
      { title: 'Backwater Runoff Alert', desc: 'Port container transit gates on waterlogged notice' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 8, confidence: 100 },
      { time: 'T-15m', amount: 22, confidence: 100 },
      { time: 'NOW', amount: 44, confidence: 95 },
      { time: 'T+15m', amount: 54, confidence: 90 },
      { time: 'T+30m', amount: 38, confidence: 85 },
      { time: 'T+45m', amount: 20, confidence: 75 },
      { time: 'T+60m', amount: 8, confidence: 65 },
    ]
  },
  {
    id: 'guwahati',
    name: 'Guwahati',
    state: 'Assam',
    coordinates: [91.7362, 26.1445],
    temp: 27.2,
    humidity: 86,
    wind: 16,
    aqi: 48,
    cape: 1950,
    windShear: 29,
    rainRate: '68 mm/hr',
    threat: 'Severe',
    dangerLevel: 'DANGER',
    statusClass: 'status-danger',
    color: '#ef4444',
    minZoom: 4.5,
    point1: 'Brahmaputra Valley Deluge: Stationary cloudburst cell over basin',
    point2: 'Landslide Warning: Hillslope soil saturation index at 92%',
    radarEcho: '66 dBZ Stationary',
    alerts: [
      { title: 'Stationary Cloudburst Alert', level: 'Level 3 Severe', confidence: 94, eta: 12 },
      { title: 'Hillslope Soil Saturation', desc: 'Critical slope runoff warning along NH27' }
    ],
    precipitation: [
      { time: 'T-30m', amount: 10, confidence: 100 },
      { time: 'T-15m', amount: 32, confidence: 100 },
      { time: 'NOW', amount: 56, confidence: 98 },
      { time: 'T+15m', amount: 68, confidence: 94 },
      { time: 'T+30m', amount: 52, confidence: 88 },
      { time: 'T+45m', amount: 30, confidence: 78 },
      { time: 'T+60m', amount: 14, confidence: 65 },
    ]
  }
];


function getCleanApiBase(): string {
  return getApiBaseUrl();
}

const SPEED_DELAYS: Record<number, number> = {
  0.5: 2000,
  1: 1000,
  2: 500,
  4: 250,
};

export default function Dashboard() {
  const { theme } = useTheme();
  const [timeIdx, setTimeIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isRadarLoading, setIsRadarLoading] = useState<boolean>(false);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const frameCacheRef = useRef<Map<number, string>>(new Map());
  const activeRequestIdRef = useRef<number>(0);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

  // Clean up cached blob URLs on component unmount
  useEffect(() => {
    return () => {
      frameCacheRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      });
      frameCacheRef.current.clear();
    };
  }, []);

  // Active Selected City (defaults to Bengaluru)
  const [selectedCity, setSelectedCity] = useState<CityWeatherItem>(CITIES_DATA[0]);
  const [currentZoom, setCurrentZoom] = useState<number>(11);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [precipitationData, setPrecipitationData] = useState(CITIES_DATA[0].precipitation);
  const [showTerminal, setShowTerminal] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [mapLayerType, setMapLayerType] = useState<'radar' | 'satellite'>('radar');
  const [showStormCells, setShowStormCells] = useState<boolean>(true);

  const [telemetry, setTelemetry] = useState({
    temp: CITIES_DATA[0].temp,
    humidity: CITIES_DATA[0].humidity,
    wind: CITIES_DATA[0].wind,
    aqi: CITIES_DATA[0].aqi,
    cape: CITIES_DATA[0].cape,
    windShear: CITIES_DATA[0].windShear
  });

  const [validationMetrics] = useState({
    csi: 0.82,
    far: 0.14
  });

  const [alerts, setAlerts] = useState(CITIES_DATA[0].alerts);
  const [radarMetadata, setRadarMetadata] = useState<RadarMetadata | null>(null);
  const API_BASE = getCleanApiBase();

  // Phase 7: Dynamic retrieval of authoritative radar provider metadata
  useEffect(() => {
    let isMounted = true;
    fetchRadarMetadata()
      .then((meta) => {
        if (isMounted && meta) {
          setRadarMetadata(meta);
        }
      })
      .catch((err) => {
        console.warn('[VAJRA Radar] Provider metadata fetch error:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Function to select a city and smoothly fly the map to it
  const handleSelectCity = useCallback((city: CityWeatherItem) => {
    setSelectedCity(city);
    setTelemetry({
      temp: city.temp,
      humidity: city.humidity,
      wind: city.wind,
      aqi: city.aqi,
      cape: city.cape,
      windShear: city.windShear
    });
    setPrecipitationData(city.precipitation);
    setAlerts(city.alerts);

    // Smoothly fly real map to target city coordinates
    if (mapInstance) {
      const targetZoom = Math.max(mapInstance.getZoom(), city.minZoom >= 9 ? 11.5 : 9.5);
      mapInstance.flyTo({
        center: city.coordinates,
        zoom: targetZoom,
        essential: true,
        duration: 1500
      });
    }
  }, [mapInstance]);

  const handleSelectCityRef = useRef(handleSelectCity);
  useEffect(() => {
    handleSelectCityRef.current = handleSelectCity;
  }, [handleSelectCity]);

  // Wire up map ready and interaction with stable callback
  const handleMapReady = useCallback((m: mapboxgl.Map) => {
    setMapInstance(m);
    setCurrentZoom(m.getZoom());

    m.on('zoom', () => {
      setCurrentZoom(m.getZoom());
    });

    // Map click handler to sample closest city in target sector
    m.on('click', (e) => {
      const clickLng = e.lngLat.lng;
      const clickLat = e.lngLat.lat;

      let closest = CITIES_DATA[0];
      let minDist = Infinity;
      CITIES_DATA.forEach(c => {
        const d = Math.hypot(c.coordinates[0] - clickLng, c.coordinates[1] - clickLat);
        if (d < minDist) {
          minDist = d;
          closest = c;
        }
      });

      if (minDist < 0.8) {
        handleSelectCityRef.current(closest);
      }
    });
  }, []);

  // Terminal logging simulator
  useEffect(() => {
    if (!showTerminal) return;
    const logMessages = [
      "Dask Scheduler: Received Zarr array block [2048x2048]",
      "Worker 0: Allocating 4GB VRAM on GPU 0",
      "Worker 1: Computing spatial convolutions...",
      "MLOps: Model weights synced from MLflow registry",
      "Dask: Task graph compiled. 1420 tasks pending",
      "Worker 2: Evicting memory to host. 98% utilization",
      "Inference Engine: Forward pass complete in 42ms",
      "Pipeline: Nowcast generation successful. Merging outputs..."
    ];
    
    const interval = setInterval(() => {
      setLogs(prev => {
        const newLog = `[${new Date().toISOString().split('T')[1].slice(0,11)}] ${logMessages[Math.floor(Math.random() * logMessages.length)]}`;
        const updated = [...prev, newLog];
        return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
      });
    }, 600);
    
    return () => clearInterval(interval);
  }, [showTerminal]);

  useEffect(() => {
    if (showTerminal && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, showTerminal]);

  // Helper to apply frame texture to Mapbox ImageSource
  const applyFrameToMap = useCallback((url: string) => {
    if (!mapInstance) return;
    try {
      const source = mapInstance.getSource(RADAR_SOURCE_ID) as mapboxgl.ImageSource | undefined;
      if (source && typeof source.updateImage === 'function') {
        source.updateImage({
          url,
          coordinates: BENGALURU_RADAR_BOUNDS,
        });
      }
    } catch (err) {
      console.warn('[VAJRA Radar] ImageSource updateImage error:', err);
    }
  }, [mapInstance]);

  // Quietly prefetch adjacent frames into memory blob cache
  const prefetchFrame = useCallback((targetIdx: number) => {
    if (targetIdx < 0 || targetIdx > 17) return;
    if (frameCacheRef.current.has(targetIdx)) return;

    fetch(`${API_BASE}/api/radar/frame/${targetIdx}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!frameCacheRef.current.has(targetIdx)) {
          const objUrl = URL.createObjectURL(blob);
          frameCacheRef.current.set(targetIdx, objUrl);
        }
      })
      .catch(() => {
        // Quietly ignore background prefetch errors
      });
  }, [API_BASE]);

  // Playback timer with speed control and automatic boundary stop at frame 17
  useEffect(() => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (!isPlaying) return;

    const delay = SPEED_DELAYS[playbackSpeed] || 1000;

    playbackTimerRef.current = setInterval(() => {
      setTimeIdx((prev) => {
        if (prev >= 17) {
          setIsPlaying(false);
          return 17;
        }
        return prev + 1;
      });
    }, delay);

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed]);

  // Update Mapbox radar raster overlay with in-memory caching & race-condition protection
  useEffect(() => {
    if (!mapInstance) return;

    const currentReqId = ++activeRequestIdRef.current;
    const targetIdx = Math.max(0, Math.min(17, Math.floor(timeIdx)));

    // Fast path: cached blob in memory
    if (frameCacheRef.current.has(targetIdx)) {
      const cachedUrl = frameCacheRef.current.get(targetIdx)!;
      applyFrameToMap(cachedUrl);
      setIsRadarLoading(false);

      // Prefetch adjacent frames
      prefetchFrame(targetIdx + 1);
      prefetchFrame(targetIdx - 1);
      return;
    }

    // Cache miss: initiate network request with active loading state
    setIsRadarLoading(true);

    fetch(`${API_BASE}/api/radar/frame/${targetIdx}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        // Race condition protection: Discard if newer request was dispatched while fetching
        if (currentReqId !== activeRequestIdRef.current) {
          return;
        }

        const objUrl = URL.createObjectURL(blob);
        frameCacheRef.current.set(targetIdx, objUrl);
        applyFrameToMap(objUrl);
        setIsRadarLoading(false);

        // Prefetch adjacent frames
        prefetchFrame(targetIdx + 1);
        prefetchFrame(targetIdx - 1);
      })
      .catch((err) => {
        if (currentReqId === activeRequestIdRef.current) {
          console.warn(`[VAJRA Radar] Error loading frame ${targetIdx}:`, err);
          applyFrameToMap(`${API_BASE}/api/radar/frame/${targetIdx}`);
          setIsRadarLoading(false);
        }
      });
  }, [timeIdx, mapInstance, API_BASE, applyFrameToMap, prefetchFrame]);

  // Synchronize layer visibility when user switches between Radar and Satellite in top bar
  useEffect(() => {
    if (!mapInstance) return;
    try {
      if (mapInstance.getLayer(RADAR_LAYER_ID)) {
        mapInstance.setLayoutProperty(
          RADAR_LAYER_ID,
          'visibility',
          mapLayerType === 'radar' ? 'visible' : 'none'
        );
      }
    } catch (err) {
      console.warn('[VAJRA Map] Layer visibility toggle error:', err);
    }
  }, [mapLayerType, mapInstance]);

  const isSevere = alerts.some(a => a.level && a.level.toLowerCase().includes('severe'));

  // Filter cities for search dropdown
  const filteredCities = searchQuery.trim() === '' 
    ? CITIES_DATA.slice(0, 6)
    : CITIES_DATA.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.state.toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className={`dashboard-container ${isSevere ? 'threat-state-severe' : ''}`}>
      {/* Genuine Mapbox GL JS Base */}
      <VajraMap
        onMapReady={handleMapReady}
        timeIdx={timeIdx}
        isPlaying={isPlaying}
        stormCellsVisible={showStormCells}
        className="map-background"
      >
        <MapControls
          map={mapInstance}
          stormCellsVisible={showStormCells}
          onToggleStormCells={setShowStormCells}
          style={{
            position: 'absolute',
            top: '95px',
            left: '20px',
          }}
        />
        <MapLegend
          style={{
            position: 'absolute',
            bottom: '115px',
            left: '20px',
          }}
          sourceDisclosure={radarMetadata?.status_disclosure ? (radarMetadata.synthetic_demo ? 'SYNTHETIC • DEMO' : radarMetadata.status_disclosure) : 'SYNTHETIC • DEMO'}
          isSynthetic={radarMetadata ? radarMetadata.synthetic_demo : true}
        />
      </VajraMap>

      {/* Floating Top Bar */}
      <header className="glass-panel top-bar">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <h1>VAJRA</h1>
            <span className="live-badge">{mapLayerType === 'radar' ? 'RADAR REFLECTIVITY' : 'SATELLITE FUSION'} &bull; 0.5km RES (SIMULATION)</span>
          </div>

          {/* Phase 7: Canonical Operational Data Source Indicator */}
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              paddingLeft: '10px',
              borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
              marginLeft: '4px',
            }}
            title={radarMetadata?.disclaimer || "Synthetic procedural Gaussian advection model. Demo only."}
          >
            <span style={{ fontSize: '8px', letterSpacing: '0.6px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, lineHeight: 1.1 }}>
              DATA SOURCE
            </span>
            <span style={{ 
              fontSize: '10px', 
              color: radarMetadata?.synthetic_demo !== false ? '#fbbf24' : '#38bdf8', 
              fontWeight: 700, 
              letterSpacing: '0.4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: radarMetadata?.synthetic_demo !== false ? '#fbbf24' : '#22c55e', display: 'inline-block' }} />
              {radarMetadata?.status_disclosure ? (radarMetadata.synthetic_demo ? 'SYNTHETIC • DEMO' : radarMetadata.status_disclosure) : 'SYNTHETIC • DEMO'}
            </span>
          </div>
        </div>

        {/* Interactive Search Container with Autocomplete Dropdown */}
        <div className="search-container" style={{ position: 'relative' }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search City or Sector (e.g. Mumbai, Delhi, Bellandur)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredCities.length > 0) {
                handleSelectCity(filteredCities[0]);
                setIsSearchFocused(false);
              }
            }}
          />

          {/* Autocomplete City Dropdown */}
          {isSearchFocused && (
            <div 
              style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                right: 0,
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                zIndex: 50,
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '6px'
              }}
              onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
            >
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', padding: '6px 10px', fontWeight: 'bold' }}>
                Select City / Weather Radar Grid
              </div>
              {filteredCities.map(city => (
                <div
                  key={city.id}
                  onClick={() => {
                    handleSelectCity(city);
                    setSearchQuery(city.name);
                    setIsSearchFocused(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedCity?.id === city.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    borderLeft: selectedCity?.id === city.id ? `3px solid ${city.color}` : '3px solid transparent',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = selectedCity?.id === city.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent'}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {city.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {city.state} • {city.radarEcho}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: city.color, padding: '2px 6px', borderRadius: '4px', background: `${city.color}20` }}>
                      {city.threat}
                    </span>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {city.temp}°C
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="view-toggle" style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '20px', padding: '4px' }}>
          <button 
            onClick={() => setMapLayerType('radar')}
            style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', background: mapLayerType === 'radar' ? 'var(--color-precip)' : 'transparent', color: mapLayerType === 'radar' ? '#000' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
            Radar
          </button>
          <button 
            onClick={() => setMapLayerType('satellite')}
            style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', background: mapLayerType === 'satellite' ? 'var(--color-precip)' : 'transparent', color: mapLayerType === 'satellite' ? '#000' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
            Satellite Fusion
          </button>
        </div>

        <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/disaster-ops" className="nav-link-btn" title="Municipal Disaster Ops & Civil Defense">
            <ShieldAlert size={14} color="#ef4444" />
            <span>Disaster Ops</span>
          </Link>
          <Link href="/replay" className="nav-link-btn" title="Historical Storm Replay & Benchmarks">
            <RotateCcw size={14} color="var(--color-precip)" />
            <span>Case Studies</span>
          </Link>
          <Link href="/thermodynamics" className="nav-link-btn" title="Vertical Atmospheric Soundings (Skew-T)">
            <Thermometer size={14} color="#f59e0b" />
            <span>Soundings</span>
          </Link>
          <Link href="/aviation" className="nav-link-btn" title="Aviation Weather & Runway Safety">
            <Plane size={14} color="#60A5FA" />
            <span>Aviation</span>
          </Link>
          <Link href="/analytics" className="nav-link-btn" title="Meteorological Validation & Analytics">
            <BarChart2 size={14} />
            <span>Analytics</span>
          </Link>
          <Link href="/models" className="nav-link-btn" title="Physics Fusion & Explainability (XAI)">
            <Cpu size={14} />
            <span>Models</span>
          </Link>

          <button 
            className="nav-icon" 
            title="MLOps Terminal"
            onClick={() => setShowTerminal(!showTerminal)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
          >
            <Terminal size={18} />
          </button>
          <Link href="/alerts" className="nav-icon" title="Active Severe Alerts" style={{ padding: '0 4px' }}>
            <AlertTriangle size={18} color="var(--color-severe)" />
          </Link>
          <Link href="/settings" className="nav-icon" title="Settings" style={{ padding: '0 4px' }}>
            <Settings size={18} />
          </Link>
        </div>
      </header>

      {/* Interactive Sidebar: Dynamic City Deep-Dive with the 2 Key Points */}
      <aside className="glass-panel sidebar" style={{ zIndex: 20 }}>
        <div className="sidebar-header">
          <h2>AI Nowcast Stream</h2>
          <div className="pulse-indicator"></div>
        </div>

        {/* Location Deep-Dive & Main 2 Meteorological Points */}
        <div className="telemetry-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              {selectedCity ? selectedCity.name : 'Location Deep-Dive'}
            </h3>
            {selectedCity && (
              <span style={{ 
                fontSize: '11px', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                background: `${selectedCity.color}25`, 
                color: selectedCity.color,
                fontWeight: 'bold',
                border: `1px solid ${selectedCity.color}50`
              }}>
                {selectedCity.threat}
              </span>
            )}
          </div>

          {/* The 2 Main Key Points Card */}
          {selectedCity && (
            <div style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: `1px solid ${selectedCity.color}40`, 
              borderRadius: '8px', 
              padding: '10px 12px', 
              marginBottom: '16px', 
              fontSize: '12px',
              lineHeight: '1.45',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                Key Meteorological Points ({selectedCity.state})
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <span style={{ color: selectedCity.color, fontWeight: 'bold' }}>•</span>
                <span style={{ color: 'var(--text-primary)' }}>{selectedCity.point1}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ color: selectedCity.color, fontWeight: 'bold' }}>•</span>
                <span style={{ color: 'var(--text-primary)' }}>{selectedCity.point2}</span>
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="metric">
              <span>Temp</span>
              <strong>{telemetry.temp}&deg;C</strong>
            </div>
            <div className="metric">
              <span>Humidity</span>
              <strong>{telemetry.humidity}%</strong>
            </div>
            <div className="metric">
              <span>Wind</span>
              <strong>{telemetry.wind} km/h</strong>
            </div>
            <div className="metric">
              <span>CAPE</span>
              <strong>{telemetry.cape}</strong>
            </div>
            <div className="metric">
              <span>Shear</span>
              <strong>{telemetry.windShear} kt</strong>
            </div>
            <div className="metric">
              <span>AQI</span>
              <strong style={{ color: telemetry.aqi > 100 ? 'var(--color-severe)' : telemetry.aqi > 50 ? 'var(--color-warning)' : '#4CAF50' }}>{telemetry.aqi}</strong>
            </div>
          </div>

          {/* Localized Precipitation Forecast Chart */}
          <div className="chart-container">
            <h4>Precipitation Forecast & AI Confidence</h4>
            <ResponsiveContainer width="100%" height={120}>
              <ComposedChart data={precipitationData}>
                <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={10} />
                <YAxis yAxisId="left" hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} hide />
                <Tooltip
                  cursor={{ fill: 'var(--glass-bg)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: 'none', borderRadius: '4px', fontSize: '12px' }}
                />
                <Bar yAxisId="left" dataKey="amount" fill="var(--color-precip)" radius={[4, 4, 0, 0]} name="Rain (mm)" />
                <Line yAxisId="right" type="monotone" dataKey="confidence" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 3 }} name="Confidence %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {/* Validation Metrics */}
          <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', borderLeft: '4px solid #10B981' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Live Validation Metrics</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Critical Success Index (CSI)</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10B981' }}>{validationMetrics.csi}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>False Alarm Ratio (FAR)</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-warning)' }}>{validationMetrics.far}</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Bottom Timeline Dock with Play/Pause & Step Controls */}
      <div className="glass-panel bottom-dock" style={{ zIndex: 30, display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="timeline-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              if (isPlaying) {
                setIsPlaying(false);
              } else {
                if (timeIdx >= 17) {
                  setTimeIdx(0);
                }
                setIsPlaying(true);
              }
            }}
            style={{
              background: isPlaying ? 'var(--color-severe)' : 'var(--color-precip)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s, background 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              flexShrink: 0
            }}
            title={isPlaying ? "Pause Radar Playback" : "Play Radar Forecast Loop (T+0 → T+85)"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setTimeIdx((prev) => Math.max(0, prev - 1));
            }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Previous Step (-5m)"
          >
            <SkipBack size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setTimeIdx((prev) => Math.min(17, prev + 1));
            }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Next Step (+5m)"
          >
            <SkipForward size={14} />
          </button>

          {/* Compact Playback Speed Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid var(--border-color)',
              marginLeft: '2px',
            }}
            title="Playback Temporal Speed"
          >
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlaybackSpeed(s)}
                style={{
                  background: playbackSpeed === s ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                  color: playbackSpeed === s ? '#38bdf8' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {s}×
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
            <Clock size={16} />
            <span style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>Horizon</span>
          </div>
        </div>

        <div className="scrubber-container" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, position: 'relative', zIndex: 35 }}>
          <span className="time-label" style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>
            {radarMetadata && !radarMetadata.synthetic_demo ? 'T+0m' : 'T+0 MIN'}
          </span>
          <input
            type="range"
            min="0"
            max={String(Math.max(0, (radarMetadata?.frame_count || 18) - 1))}
            step="1"
            value={Math.min(timeIdx, Math.max(0, (radarMetadata?.frame_count || 18) - 1))}
            onPointerDown={() => {
              if (isPlaying) setIsPlaying(false);
            }}
            onChange={(e) => {
              if (isPlaying) setIsPlaying(false);
              const val = parseInt(e.target.value, 10);
              setTimeIdx(val);
            }}
            style={{
              flex: 1,
              cursor: 'pointer',
              accentColor: 'var(--color-precip)',
              height: '8px',
              borderRadius: '4px',
              touchAction: 'none'
            }}
          />
          <span className="time-label" style={{ minWidth: '75px', fontWeight: 'bold', color: 'var(--color-precip)', fontSize: '12px', textAlign: 'right' }}>
            {radarMetadata && !radarMetadata.synthetic_demo
              ? (radarMetadata.temporal_range.timestamps_utc?.[timeIdx]?.slice(11, 16) 
                  ? `${radarMetadata.temporal_range.timestamps_utc[timeIdx].slice(11, 16)} UTC`
                  : `T+${timeIdx * (radarMetadata.interval_minutes || 10)}m`)
              : `T+${timeIdx * 5} MIN`}
          </span>

          {/* Operational Radar Frame Status Badge with Updating Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              background: isRadarLoading ? 'rgba(245, 158, 11, 0.14)' : 'rgba(56, 189, 248, 0.12)',
              border: isRadarLoading ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              color: isRadarLoading ? '#f59e0b' : '#38bdf8',
              letterSpacing: '0.4px',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'all 0.2s',
            }}
            title="Operational radar frame index and forecast offset"
          >
            <span>RADAR</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
            <span>FRAME {String(timeIdx + 1).padStart(2, '0')}/{radarMetadata?.frame_count || 18}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
            <span>
              {radarMetadata && !radarMetadata.synthetic_demo
                ? (radarMetadata.temporal_range.timestamps_utc?.[timeIdx]?.slice(11, 16)
                    ? `${radarMetadata.temporal_range.timestamps_utc[timeIdx].slice(11, 16)} UTC`
                    : `T+${timeIdx * (radarMetadata.interval_minutes || 10)}m`)
                : `T+${timeIdx * 5} MIN`}
            </span>
            {isRadarLoading && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
                <span style={{ color: '#f59e0b' }}>UPDATING</span>
              </>
            )}
          </div>
        </div>

      </div>

      {/* MLOps Floating Terminal Modal */}
      {showTerminal && (
        <div 
          className="glass-panel"
          style={{
            position: 'absolute',
            bottom: '90px',
            right: '380px',
            width: '520px',
            height: '320px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 40,
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-color)',
            background: 'rgba(10, 14, 23, 0.95)'
          }}
        >
          <div style={{
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} color="#10B981" />
              <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px' }}>VAJRA HPC &amp; MLOps Ingestion Pipeline</span>
            </div>
            <button 
              onClick={() => setShowTerminal(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}
            >
              &times;
            </button>
          </div>
          <div style={{
            flex: 1,
            padding: '12px 14px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#10B981',
            lineHeight: '1.6',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {logs.map((log, index) => (
              <div key={index} style={{ wordBreak: 'break-all' }}>{log}</div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
