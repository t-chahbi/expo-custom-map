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
  recordTileLoadTime: (loadTime: number) => void;
  recordCacheHit: () => void;
  recordCacheMiss: () => void;
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
  const requestRef = useRef<number | null>(null);
  
  const lastFrameTimeRef = useRef(0);
  const frameTimesRef = useRef<number[]>([]);
  const tileLoadTimesRef = useRef<number[]>([]);
  const cacheHitsRef = useRef(0);
  const cacheMissesRef = useRef(0);

  // Loop requestAnimationFrame pour mesurer le framerate de rendu réel
  const renderLoop = useCallback((timestamp: number) => {
    if (lastFrameTimeRef.current > 0) {
      const frameTime = timestamp - lastFrameTimeRef.current;
      
      // Filtrer les valeurs aberrantes (comme le premier frame)
      if (frameTime < 200) {
        frameTimesRef.current.push(frameTime);
        
        // Garder les 60 dernières mesures
        if (frameTimesRef.current.length > 60) {
          frameTimesRef.current.shift();
        }
        
        // Calculer les FPS moyens
        const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        const fps = Math.round(1000 / avgFrameTime);
        
        setStats(prev => ({
          ...prev,
          fps: Math.min(fps, 60), // Cap à 60 FPS
          frameTime: Math.round(avgFrameTime * 100) / 100,
        }));
      }
    }
    lastFrameTimeRef.current = timestamp;
    requestRef.current = requestAnimationFrame(renderLoop);
  }, []);

  // Enregistrer le temps de chargement d'une tuile
  const recordTileLoadTime = useCallback((loadTime: number) => {
    tileLoadTimesRef.current.push(loadTime);
    
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

  // Estimer l'utilisation mémoire (de manière peu coûteuse)
  const estimateMemoryUsage = useCallback(() => {
    const performanceObj = global.performance as any;
    if (performanceObj && 'memory' in performanceObj) {
      const memInfo = performanceObj.memory;
      const usedJSHeapSize = memInfo.usedJSHeapSize;
      const memoryUsageMB = Math.round((usedJSHeapSize / 1024 / 1024) * 100) / 100;
      
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
    lastFrameTimeRef.current = 0;
    frameTimesRef.current = [];
    
    requestRef.current = requestAnimationFrame(renderLoop);
    
    // Mesurer la mémoire de manière espacée (toutes les 5 secondes) pour économiser le CPU
    intervalRef.current = setInterval(() => {
      estimateMemoryUsage();
    }, 5000);
  }, [isMonitoring, renderLoop, estimateMemoryUsage]);

  // Arrêter la surveillance
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;
    
    setIsMonitoring(false);
    
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isMonitoring]);

  // Réinitialiser les statistiques
  const resetStats = useCallback(() => {
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

  // Nettoyage lors de la désinscription
  useEffect(() => {
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
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
    recordTileLoadTime,
    recordCacheHit,
    recordCacheMiss,
  };
};

export default useMapPerformance;