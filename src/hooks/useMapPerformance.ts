// src/hooks/useMapPerformance.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { PerformanceStats, CacheStats } from '../types';

interface PerformanceHookResult {
  stats: PerformanceStats;
  cache: CacheStats;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  resetStats: () => void;
  isMonitoring: boolean;
}

const useMapPerformance = (): PerformanceHookResult => {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    frameTime: 0,
    tileLoadTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
  });

  const [cache, setCache] = useState<CacheStats>({
    size: 0,
    currentSizeMB: 0,
    maxSizeMB: 100,
    hitRate: 0,
  });

  const [isMonitoring, setIsMonitoring] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const frameTimesRef = useRef<number[]>([]);
  const tileLoadTimesRef = useRef<number[]>([]);
  const cacheHitsRef = useRef(0);
  const cacheMissesRef = useRef(0);

  // Mesurer les FPS
  const measureFPS = useCallback(() => {
    const now = performance.now();
    if (lastFrameTimeRef.current > 0) {
      const frameTime = now - lastFrameTimeRef.current;
      frameTimesRef.current.push(frameTime);
      
      // Garder seulement les 60 dernières mesures
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }
      
      // Calculer FPS moyen
      const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      const fps = Math.round(1000 / avgFrameTime);
      
      setStats(prev => ({
        ...prev,
        fps: Math.min(fps, 60), // Cap à 60 FPS
        frameTime: Math.round(avgFrameTime * 100) / 100,
      }));
    }
    lastFrameTimeRef.current = now;
    frameCountRef.current++;
  }, []);

  // Enregistrer le temps de chargement d'une tuile
  const recordTileLoadTime = useCallback((loadTime: number) => {
    tileLoadTimesRef.current.push(loadTime);
    
    // Garder seulement les 100 dernières mesures
    if (tileLoadTimesRef.current.length > 100) {
      tileLoadTimesRef.current.shift();
    }
    
    const avgTileLoadTime = tileLoadTimesRef.current.reduce((a, b) => a + b, 0) / tileLoadTimesRef.current.length;
    
    setStats(prev => ({
      ...prev,
      tileLoadTime: Math.round(avgTileLoadTime),
    }));
  }, []);

  // Enregistrer un hit de cache
  const recordCacheHit = useCallback(() => {
    cacheHitsRef.current++;
    updateCacheStats();
  }, []);

  // Enregistrer un miss de cache
  const recordCacheMiss = useCallback(() => {
    cacheMissesRef.current++;
    updateCacheStats();
  }, []);

  // Mettre à jour les statistiques de cache
  const updateCacheStats = useCallback(() => {
    const totalRequests = cacheHitsRef.current + cacheMissesRef.current;
    const hitRate = totalRequests > 0 ? cacheHitsRef.current / totalRequests : 0;
    
    setStats(prev => ({
      ...prev,
      cacheHitRate: Math.round(hitRate * 100) / 100,
    }));
    
    setCache(prev => ({
      ...prev,
      hitRate: Math.round(hitRate * 100) / 100,
    }));
  }, []);

  // Estimer l'utilisation mémoire
  const estimateMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedJSHeapSize = memInfo.usedJSHeapSize;
      const memoryUsageMB = Math.round(usedJSHeapSize / 1024 / 1024 * 100) / 100;
      
      setStats(prev => ({
        ...prev,
        memoryUsage: memoryUsageMB,
      }));
    }
  }, []);

  // Démarrer la surveillance
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;
    
    setIsMonitoring(true);
    
    // Surveillance des FPS et mémoire
    intervalRef.current = setInterval(() => {
      measureFPS();
      estimateMemoryUsage();
    }, 1000 / 60); // 60 FPS
  }, [isMonitoring, measureFPS, estimateMemoryUsage]);

  // Arrêter la surveillance
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;
    
    setIsMonitoring(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isMonitoring]);

  // Réinitialiser les statistiques
  const resetStats = useCallback(() => {
    frameCountRef.current = 0;
    lastFrameTimeRef.current = 0;
    frameTimesRef.current = [];
    tileLoadTimesRef.current = [];
    cacheHitsRef.current = 0;
    cacheMissesRef.current = 0;
    
    setStats({
      fps: 0,
      frameTime: 0,
      tileLoadTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
    });
    
    setCache(prev => ({
      ...prev,
      hitRate: 0,
    }));
  }, []);

  // Nettoyer à la désinscription
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    stats,
    cache,
    startMonitoring,
    stopMonitoring,
    resetStats,
    isMonitoring,
  };
};

export default useMapPerformance;