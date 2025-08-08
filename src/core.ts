// src/core.ts
// Core exports without React Native dependencies

export { TileCache } from './TileCache';
export { TilePreloader } from './TilePreloader';

// Performance Optimizations (les parties qui ne dépendent pas de React Native)
export {
  PERFORMANCE_CONSTANTS,
  MemoryManager,
  FrameRateManager,
  ThrottleUtils,
  AdaptiveConfig,
} from './PerformanceOptimizations';

// Utils
export * from './utils';

// Types (seulement ceux qui ne dépendent pas de React)
export type {
  TileInfo,
  CacheStats,
  PerformanceStats,
  MapRegion,
} from './types';
