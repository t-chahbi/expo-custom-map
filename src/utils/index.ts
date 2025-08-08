// src/utils/index.ts

// Export all geographical utilities
export * from './geoUtils';

// Export all mathematical utilities
export * from './mathUtils';

// Re-export commonly used functions with cleaner names
export {
  deg2rad as degreesToRadians,
  rad2deg as radiansToDegrees,
  calculateDistance as getDistanceBetween,
  calculateBearing as getBearingBetween,
  latLonToTile as coordinateToTile,
  tileToLatLon as tileToCoordinate,
  normalizeCoordinate as normalizeCoordinates,
  interpolateCoordinates as interpolateCoords,
} from './geoUtils';

export {
  clamp as clampValue,
  lerp as interpolate,
  distance2D as getDistance2D,
  isPointInRect as isPointInRectangle,
  roundToDecimals as roundTo,
  normalizeAngleDegrees as normalizeDegrees,
  normalizeAngleRadians as normalizeRadians,
} from './mathUtils';

// Utility constants
export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_MILES = 3959;
export const DEGREES_PER_RADIAN = 180 / Math.PI;
export const RADIANS_PER_DEGREE = Math.PI / 180;

// Default tile configurations
export const DEFAULT_TILE_SIZE = 256;
export const DEFAULT_MAX_ZOOM = 18;
export const DEFAULT_MIN_ZOOM = 1;

// Performance constants
export const DEFAULT_THROTTLE_MS = 16; // ~60fps
export const DEFAULT_DEBOUNCE_MS = 100;
export const DEFAULT_CACHE_SIZE_MB = 100;

// Animation constants
export const DEFAULT_ANIMATION_DURATION = 300;
export const SMOOTH_ANIMATION_DURATION = 500;
export const FAST_ANIMATION_DURATION = 150;