// src/hooks/useOptimizedGestures.ts
import { useCallback, useRef, useMemo } from 'react';
import { MapRegion } from '../types';
import { throttle, debounce, clamp } from '../utils/mathUtils';

interface GestureConfig {
  enablePan: boolean;
  enableZoom: boolean;
  enableRotation: boolean;
  minZoom: number;
  maxZoom: number;
  zoomSensitivity: number;
  panSensitivity: number;
  rotationSensitivity: number;
  animationDuration: number;
}

interface OptimizedGesturesResult {
  throttledRegionChange: (region: MapRegion) => void;
  debouncedRegionChange: (region: MapRegion) => void;
  region: MapRegion;
  setRegion: (region: MapRegion) => void;
  resetToInitial: () => void;
  calculateNewRegion: (deltaX: number, deltaY: number, scaleChange: number) => MapRegion;
}

const defaultConfig: GestureConfig = {
  enablePan: true,
  enableZoom: true,
  enableRotation: false,
  minZoom: 1,
  maxZoom: 18,
  zoomSensitivity: 1,
  panSensitivity: 1,
  rotationSensitivity: 1,
  animationDuration: 300,
};

const useOptimizedGestures = (
  initialRegion: MapRegion,
  onRegionChange?: (region: MapRegion, isUserInteraction: boolean) => void,
  config: Partial<GestureConfig> = {}
): OptimizedGesturesResult => {
  const gestureConfig = useMemo(() => ({ ...defaultConfig, ...config }), [config]);
  
  // État de la région actuelle
  const currentRegion = useRef<MapRegion>(initialRegion);
  const initialRegionRef = useRef<MapRegion>(initialRegion);
  
  // Throttled callbacks pour optimiser les performances
  const throttledRegionChange = useMemo(
    () => throttle((region: MapRegion) => {
      onRegionChange?.(region, true);
    }, 16), // ~60fps
    [onRegionChange]
  );

  const debouncedRegionChange = useMemo(
    () => debounce((region: MapRegion) => {
      onRegionChange?.(region, true);
    }, 100),
    [onRegionChange]
  );

  // Calculer la nouvelle région basée sur les gestes
  const calculateNewRegion = useCallback((
    deltaX: number,
    deltaY: number,
    scaleChange: number
  ): MapRegion => {
    const { latitude, longitude, zoom } = currentRegion.current;
    
    // Calculer le nouveau zoom avec contraintes
    const newZoom = clamp(
      zoom + Math.log2(scaleChange) * gestureConfig.zoomSensitivity,
      gestureConfig.minZoom,
      gestureConfig.maxZoom
    );
    
    // Calculer le facteur de conversion coordonnées <-> pixels
    const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, newZoom);
    
    // Convertir les deltas pixels en coordonnées géographiques
    const deltaLat = (deltaY * metersPerPixel * gestureConfig.panSensitivity) / 111320;
    const deltaLon = (deltaX * metersPerPixel * gestureConfig.panSensitivity) / (111320 * Math.cos(latitude * Math.PI / 180));
    
    const newRegion = {
      latitude: clamp(latitude - deltaLat, -85, 85), // Limites de Mercator
      longitude: ((longitude - deltaLon + 540) % 360) - 180, // Normaliser longitude
      zoom: newZoom,
    };
    
    currentRegion.current = newRegion;
    return newRegion;
  }, [gestureConfig]);

  // Définir manuellement une nouvelle région
  const setRegion = useCallback((region: MapRegion) => {
    currentRegion.current = region;
    onRegionChange?.(region, false);
  }, [onRegionChange]);

  // Retour à la région initiale
  const resetToInitial = useCallback(() => {
    setRegion(initialRegionRef.current);
  }, [setRegion]);

  return {
    throttledRegionChange,
    debouncedRegionChange,
    region: currentRegion.current,
    setRegion,
    resetToInitial,
    calculateNewRegion,
  };
};

export default useOptimizedGestures;