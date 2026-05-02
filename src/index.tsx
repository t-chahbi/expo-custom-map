// src/index.tsx
import CustomMapView from './CustomMapView';

export { default as CustomMapView } from './CustomMapView';
export { TileCache } from './TileCache';
export { TilePreloader } from './TilePreloader';

// Components
export { default as MarkerComponent } from './components/MarkerComponent';
export { default as ClusterMarker } from './components/ClusterMarker';
export { default as TileLayer } from './components/TileLayer';

// Hooks - tous les hooks disponibles
export { default as useMapPerformance } from './hooks/useMapPerformance';
export { default as useOptimizedGestures } from './hooks/useOptimizedGestures';
export { useAdvancedTileCache } from './hooks/useAdvancedTileCache';
export { useFluidGestures } from './hooks/useFluidGestures';
export { useOfflineMap } from './hooks/useOfflineMap';

// Re-exports des hooks avec noms plus courts
export { 
  useAdvancedTileCache as useTileCache,
  useFluidGestures as useFluid 
} from './hooks';

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
