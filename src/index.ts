// src/index.ts
import CustomMapView from './CustomMapView';

export { default as CustomMapView } from './CustomMapView';
export { TileCache } from './TileCache';
export { TilePreloader } from './TilePreloader';

// Components
export { default as MarkerComponent } from './components/MarkerComponent';
export { default as ClusterMarker } from './components/ClusterMarker';
export { default as TileLayer } from './components/TileLayer';

// Hooks
export { default as useMapPerformance } from './hooks/useMapPerformance';
export { default as useOptimizedGestures } from './hooks/useOptimizedGestures';

// Utils
export * from './utils';

// Types
export * from './types';

// Performance Optimizations
export {
  PerformanceOptimizations,
  PERFORMANCE_CONSTANTS,
  MemoryManager,
  FrameRateManager,
  RenderOptimizer,
  ClusterOptimizer,
  ThrottleUtils,
  AdaptiveConfig,
} from './PerformanceOptimizations';

export default CustomMapView;