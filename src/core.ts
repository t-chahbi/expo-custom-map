// src/core.ts
// Core exports without React Native dependencies

export { TileCache } from './TileCache';
export { TilePreloader } from './TilePreloader';

// Performance Optimizations (parts that don't depend on React Native)
export {
  PERFORMANCE_CONSTANTS,
  MemoryManager,
  FrameRateManager,
  ThrottleUtils,
  AdaptiveConfig,
} from './PerformanceOptimizations';

// Utils
export * from './utils';

// Types (only those that don't depend on React)
export type {
  TileInfo,
  CacheStats,
  PerformanceStats,
  MapRegion,
} from './types';
