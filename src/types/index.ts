// src/types/index.ts
export interface MapViewProps {
  style?: any;
  center: [number, number]; // [longitude, latitude]
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  tileUrlTemplate: string;
  onRegionChange?: (region: MapRegion) => void;
  onMapPress?: (coordinate: [number, number]) => void;
  onMapReady?: () => void;
  markers?: MarkerProps[];
  showUserLocation?: boolean;
  followUserLocation?: boolean;
  enableClustering?: boolean;
  clusterRadius?: number;
  offlineTileProvider?: (z: number, x: number, y: number) => string | null;
  enableHighDPI?: boolean;
  tileSize?: number;
  cacheSize?: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  zoom: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

export interface MarkerProps {
  id?: string;
  coordinate: [number, number];
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  draggable?: boolean;
  onDragEnd?: (coordinate: [number, number]) => void;
  anchor?: { x: number; y: number };
  zIndex?: number;
}

export interface TileInfo {
  x: number;
  y: number;
  z: number;
  url: string;
  size?: number;
  timestamp?: number;
}

export interface ClusterMarkerProps {
  coordinate: [number, number];
  count: number;
  markers: MarkerProps[];
  onPress?: () => void;
  style?: any;
}

export interface RoutingOptions {
  profile?: 'driving' | 'walking' | 'cycling';
  alternatives?: boolean;
  steps?: boolean;
  overview?: 'full' | 'simplified' | 'false';
  geometries?: 'polyline' | 'polyline6' | 'geojson';
}

export interface RouteResult {
  distance: number; // meters
  duration: number; // seconds
  coordinates: [number, number][];
  instructions?: RouteInstruction[];
}

export interface RouteInstruction {
  type: string;
  instruction: string;
  distance: number;
  time: number;
  coordinate: [number, number];
}

export interface OfflineRegion {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  minZoom: number;
  maxZoom: number;
  downloadProgress?: number;
  isComplete?: boolean;
}

export interface CacheStats {
  size: number;
  currentSizeMB: number;
  maxSizeMB: number;
  hitRate?: number;
}

export interface PerformanceStats {
  fps: number;
  frameTime: number;
  tileLoadTime: number;
  cacheHitRate: number;
  memoryUsage: number;
}

// Événements personnalisés
export type MapEvent<T = any> = {
  nativeEvent: T;
};

export type RegionChangeEvent = MapEvent<{
  latitude: number;
  longitude: number;
  zoom: number;
  isUserInteraction: boolean;
}>;

export type MapPressEvent = MapEvent<{
  coordinate: [number, number];
}>;

export type MarkerPressEvent = MapEvent<{
  markerId: string;
  coordinate: [number, number];
}>;

// Configuration
export interface MapConfig {
  defaultTileSize: number;
  maxCacheSize: number;
  preloadRadius: number;
  animationDuration: number;
  debugMode: boolean;
}

// Interfaces pour les extensions
export interface TileProvider {
  getTileUrl(x: number, y: number, z: number): string;
  getAttribution?(): string;
  getMaxZoom?(): number;
  getMinZoom?(): number;
}

export interface CustomTileProvider extends TileProvider {
  name: string;
  isOnline: boolean;
  supportsBounds?: (bounds: any) => boolean;
}

// Types pour les overlays
export interface PolygonProps {
  coordinates: [number, number][];
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
}

export interface CircleProps {
  center: [number, number];
  radius: number; // meters
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
}

export interface PolylineProps {
  coordinates: [number, number][];
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  lineDashPattern?: number[];
}

// Géolocalisation
export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
}

export interface LocationResult {
  coordinate: [number, number];
  accuracy: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

// Re-export component interfaces
export type { TileLayerProps } from '../components/TileLayer';