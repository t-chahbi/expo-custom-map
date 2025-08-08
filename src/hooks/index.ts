// src/hooks/index.ts

// Export all hooks
export { default as useMapPerformance } from './useMapPerformance';
export { default as useOptimizedGestures } from './useOptimizedGestures';
export { useAdvancedTileCache } from './useAdvancedTileCache';
export { useFluidGestures } from './useFluidGestures';

// Re-export with cleaner names
export { default as usePerformance } from './useMapPerformance';
export { default as useGestures } from './useOptimizedGestures';
export { useAdvancedTileCache as useTileCache } from './useAdvancedTileCache';
export { useFluidGestures as useFluid } from './useFluidGestures';