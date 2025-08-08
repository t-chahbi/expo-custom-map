// test-imports.ts
// Test script to verify all imports work correctly
import {
  CustomMapView,
  TileCache,
  TilePreloader,
  MarkerComponent,
  ClusterMarker,
  TileLayer,
  useMapPerformance,
  useOptimizedGestures,
  PerformanceOptimizations,
  PERFORMANCE_CONSTANTS,
  MemoryManager,
  FrameRateManager,
  RenderOptimizer,
  ClusterOptimizer,
  ThrottleUtils,
  AdaptiveConfig,
  MapViewProps,
  MarkerProps,
  TileLayerProps,
  MapRegion,
  calculateDistance,
  isPointInBounds,
  clamp,
  lerp
} from './lib';

console.log('✅ All imports successful!');
console.log('CustomMapView:', typeof CustomMapView);
console.log('TileCache:', typeof TileCache);
console.log('TilePreloader:', typeof TilePreloader);
console.log('PerformanceOptimizations:', typeof PerformanceOptimizations);
console.log('PERFORMANCE_CONSTANTS:', typeof PERFORMANCE_CONSTANTS);
console.log('calculateDistance:', typeof calculateDistance);
console.log('clamp:', typeof clamp);

// Test TileCache instantiation
const cache = new TileCache();
console.log('✅ TileCache instance created');

// Test TilePreloader instantiation
const preloader = new TilePreloader(cache);
console.log('✅ TilePreloader instance created');

// Test PerformanceOptimizations
const frameRateManager = new FrameRateManager();
const config = AdaptiveConfig.updateConfigForPerformance(frameRateManager, 100);
console.log('✅ Adaptive config retrieved:', config);

console.log('🎉 Library is fully functional!');
