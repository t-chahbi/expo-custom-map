// src/PerformanceOptimizations.ts

/**
 * Configuration et optimisations de performance pour la librairie de cartes
 */

// ===========================
// CONSTANTES DE PERFORMANCE
// ===========================

export const PERFORMANCE_CONSTANTS = {
  // Limites de frame rate
  TARGET_FPS: 60,
  MIN_FRAME_TIME: 16.67, // 1000ms / 60fps

  // Cache et mémoire
  DEFAULT_TILE_CACHE_SIZE: 100, // MB
  MAX_MEMORY_USAGE: 256, // MB
  MEMORY_WARNING_THRESHOLD: 0.8, // 80% de la limite

  // Gestes et interactions
  GESTURE_THROTTLE_MS: 16, // ~60fps
  GESTURE_DEBOUNCE_MS: 100,
  ZOOM_THROTTLE_MS: 32, // ~30fps pour le zoom
  PAN_THROTTLE_MS: 16, // ~60fps pour le panoramique

  // Rendu
  MAX_MARKERS_WITHOUT_CLUSTERING: 500,
  CLUSTER_UPDATE_THROTTLE_MS: 200,
  TILE_LOAD_THROTTLE_MS: 50,
  VIEWPORT_BUFFER_RATIO: 0.2, // 20% de buffer autour du viewport

  // Préchargement
  MAX_CONCURRENT_TILE_DOWNLOADS: 4,
  TILE_PRELOAD_RADIUS: 2, // tuiles autour du centre
  PRELOAD_DELAY_MS: 100,

  // Animations
  DEFAULT_ANIMATION_DURATION: 300,
  SMOOTH_ZOOM_STEPS: 5,
  ANIMATION_EASING: 'easeOutCubic' as const,
} as const;

// ===========================
// GESTIONNAIRE DE MÉMOIRE
// ===========================

export class MemoryManager {
  private static instance: MemoryManager;
  private memoryWarningCallbacks: Array<() => void> = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Démarre la surveillance de la mémoire
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 5000); // Vérifier toutes les 5 secondes
  }

  /**
   * Arrête la surveillance de la mémoire
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Ajoute un callback pour les alertes mémoire
   */
  onMemoryWarning(callback: () => void): () => void {
    this.memoryWarningCallbacks.push(callback);
    return () => {
      const index = this.memoryWarningCallbacks.indexOf(callback);
      if (index > -1) {
        this.memoryWarningCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Force le nettoyage de la mémoire
   */
  forceCleanup(): void {
    if (global.gc) {
      global.gc();
    }
    this.triggerMemoryWarning();
  }

  private checkMemoryUsage(): void {
    // En React Native, nous utilisons une estimation basée sur les performances
    const performance = global.performance as any;
    
    if (performance?.memory) {
      const used = performance.memory.usedJSHeapSize / (1024 * 1024); // MB
      const limit = PERFORMANCE_CONSTANTS.MAX_MEMORY_USAGE;
      
      if (used / limit > PERFORMANCE_CONSTANTS.MEMORY_WARNING_THRESHOLD) {
        this.triggerMemoryWarning();
      }
    }
  }

  private triggerMemoryWarning(): void {
    this.memoryWarningCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Erreur dans le callback de warning mémoire:', error);
      }
    });
  }
}

// ===========================
// GESTIONNAIRE DE FRAME RATE
// ===========================

export class FrameRateManager {
  private frameTimeHistory: number[] = [];
  private lastFrameTime = 0;
  private dropThresholds = {
    minor: 40, // < 40 FPS
    major: 25, // < 25 FPS
    severe: 15, // < 15 FPS
  };

  /**
   * Enregistre le temps d'une frame
   */
  recordFrame(): number {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    
    if (this.lastFrameTime > 0) {
      this.frameTimeHistory.push(frameTime);
      
      // Garder seulement les 60 dernières frames (1 seconde à 60fps)
      if (this.frameTimeHistory.length > 60) {
        this.frameTimeHistory.shift();
      }
    }
    
    this.lastFrameTime = now;
    return frameTime;
  }

  /**
   * Calcule le FPS moyen
   */
  getAverageFPS(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    
    const averageFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    return Math.round(1000 / averageFrameTime);
  }

  /**
   * Détecte les baisses de performance
   */
  detectPerformanceIssues(): {
    severity: 'none' | 'minor' | 'major' | 'severe';
    fps: number;
    recommendation: string;
  } {
    const fps = this.getAverageFPS();
    
    if (fps < this.dropThresholds.severe) {
      return {
        severity: 'severe',
        fps,
        recommendation: 'Réduire drastiquement les marqueurs, désactiver le clustering, diminuer la qualité des tuiles',
      };
    } else if (fps < this.dropThresholds.major) {
      return {
        severity: 'major',
        fps,
        recommendation: 'Activer le clustering, réduire le nombre de marqueurs visibles',
      };
    } else if (fps < this.dropThresholds.minor) {
      return {
        severity: 'minor',
        fps,
        recommendation: 'Optimiser le rendu des marqueurs, réduire les animations',
      };
    }
    
    return {
      severity: 'none',
      fps,
      recommendation: 'Performance optimale',
    };
  }

  /**
   * Recommandations automatiques d'optimisation
   */
  getOptimizationRecommendations(): {
    reduceClustering: boolean;
    reduceMarkers: boolean;
    reduceTileQuality: boolean;
    disableAnimations: boolean;
  } {
    const { severity } = this.detectPerformanceIssues();
    
    return {
      reduceClustering: severity === 'severe',
      reduceMarkers: severity === 'major' || severity === 'severe',
      reduceTileQuality: severity === 'major' || severity === 'severe',
      disableAnimations: severity === 'severe',
    };
  }
}

// ===========================
// OPTIMISEUR DE RENDU
// ===========================

export class RenderOptimizer {
  private static viewportBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null = null;

  /**
   * Met à jour les limites du viewport
   */
  static updateViewportBounds(bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }): void {
    this.viewportBounds = bounds;
  }

  /**
   * Vérifie si un élément est visible dans le viewport
   */
  static isInViewport(
    x: number,
    y: number,
    bufferRatio: number = PERFORMANCE_CONSTANTS.VIEWPORT_BUFFER_RATIO
  ): boolean {
    if (!this.viewportBounds) return true;

    const { minX, maxX, minY, maxY } = this.viewportBounds;
    const bufferX = (maxX - minX) * bufferRatio;
    const bufferY = (maxY - minY) * bufferRatio;

    return (
      x >= minX - bufferX &&
      x <= maxX + bufferX &&
      y >= minY - bufferY &&
      y <= maxY + bufferY
    );
  }

  /**
   * Filtre les marqueurs visibles avec optimisation
   */
  static filterVisibleMarkers<T extends { coordinate: [number, number] }>(
    markers: T[],
    coordinateToScreen: (coord: [number, number]) => { x: number; y: number }
  ): T[] {
    if (!this.viewportBounds || markers.length === 0) return markers;

    return markers.filter(marker => {
      const screenPos = coordinateToScreen(marker.coordinate);
      return this.isInViewport(screenPos.x, screenPos.y);
    });
  }

  /**
   * Optimise la liste des tuiles à charger
   */
  static optimizeTileLoading(
    tiles: Array<{ x: number; y: number; z: number; priority: number }>,
    maxConcurrent: number = PERFORMANCE_CONSTANTS.MAX_CONCURRENT_TILE_DOWNLOADS
  ): Array<{ x: number; y: number; z: number; priority: number }> {
    // Trier par priorité (plus haute d'abord)
    const sortedTiles = [...tiles].sort((a, b) => b.priority - a.priority);
    
    // Limiter le nombre de tuiles simultanées
    return sortedTiles.slice(0, maxConcurrent);
  }
}

// ===========================
// OPTIMISEUR DE CLUSTERING
// ===========================

export class ClusterOptimizer {
  private static lastUpdate = 0;
  private static cachedClusters: any[] = [];

  /**
   * Détermine si le clustering doit être recalculé
   */
  static shouldUpdateClusters(
    markersCount: number,
    zoom: number,
    forceUpdate = false
  ): boolean {
    const now = Date.now();
    
    if (forceUpdate) return true;
    
    // Réduire la fréquence de mise à jour si beaucoup de marqueurs
    const throttleMs = markersCount > 1000 
      ? PERFORMANCE_CONSTANTS.CLUSTER_UPDATE_THROTTLE_MS * 2
      : PERFORMANCE_CONSTANTS.CLUSTER_UPDATE_THROTTLE_MS;
    
    return now - this.lastUpdate > throttleMs;
  }

  /**
   * Met à jour le cache des clusters
   */
  static updateClustersCache(clusters: any[]): void {
    this.cachedClusters = clusters;
    this.lastUpdate = Date.now();
  }

  /**
   * Obtient les clusters depuis le cache
   */
  static getCachedClusters(): any[] {
    return this.cachedClusters;
  }

  /**
   * Calcule la distance optimale pour le clustering basée sur le zoom
   */
  static getOptimalClusterDistance(zoom: number, baseDistance = 50): number {
    // Plus le zoom est élevé, plus la distance de clustering diminue
    const factor = Math.max(0.1, 1 - (zoom - 10) * 0.1);
    return baseDistance * factor;
  }
}

// ===========================
// UTILITAIRES DE THROTTLING
// ===========================

export class ThrottleUtils {
  private static throttleCache = new Map<string, {
    lastCall: number;
    timeoutId?: NodeJS.Timeout;
  }>();

  /**
   * Throttle une fonction avec une clé unique
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
    key: string
  ): T {
    return ((...args: any[]) => {
      const now = Date.now();
      const cached = this.throttleCache.get(key);
      
      if (!cached || now - cached.lastCall >= delay) {
        this.throttleCache.set(key, { lastCall: now });
        return func(...args);
      }
    }) as T;
  }

  /**
   * Debounce une fonction avec une clé unique
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
    key: string
  ): T {
    return ((...args: any[]) => {
      const cached = this.throttleCache.get(key);
      
      if (cached?.timeoutId) {
        clearTimeout(cached.timeoutId);
      }
      
      const timeoutId = setTimeout(() => {
        func(...args);
        this.throttleCache.delete(key);
      }, delay);
      
      this.throttleCache.set(key, { 
        lastCall: Date.now(), 
        timeoutId 
      });
    }) as T;
  }

  /**
   * Nettoie le cache de throttling
   */
  static clearCache(): void {
    for (const [key, cached] of this.throttleCache.entries()) {
      if (cached.timeoutId) {
        clearTimeout(cached.timeoutId);
      }
    }
    this.throttleCache.clear();
  }
}

// ===========================
// CONFIGURATION ADAPTATIVE
// ===========================

export class AdaptiveConfig {
  private static currentConfig = {
    enableClustering: true,
    clusterRadius: 50,
    maxMarkersWithoutClustering: PERFORMANCE_CONSTANTS.MAX_MARKERS_WITHOUT_CLUSTERING,
    tileLoadThrottle: PERFORMANCE_CONSTANTS.TILE_LOAD_THROTTLE_MS as number,
    enableHighDPI: true,
    enableAnimations: true,
  };

  /**
   * Met à jour la configuration basée sur les performances
   */
  static updateConfigForPerformance(
    frameRateManager: FrameRateManager,
    markersCount: number
  ): {
    enableClustering: boolean;
    clusterRadius: number;
    maxMarkersWithoutClustering: number;
    tileLoadThrottle: number;
    enableHighDPI: boolean;
    enableAnimations: boolean;
  } {
    const recommendations = frameRateManager.getOptimizationRecommendations();
    
    const newConfig = { ...this.currentConfig };
    
    // Adapter le clustering
    if (markersCount > newConfig.maxMarkersWithoutClustering) {
      newConfig.enableClustering = true;
      newConfig.clusterRadius = recommendations.reduceMarkers ? 80 : 50;
    } else {
      newConfig.enableClustering = false;
    }
    
    // Adapter la qualité des tuiles
    newConfig.enableHighDPI = !recommendations.reduceTileQuality;
    
    // Adapter les animations
    newConfig.enableAnimations = !recommendations.disableAnimations;
    
    // Adapter le throttling
    newConfig.tileLoadThrottle = recommendations.reduceTileQuality 
      ? PERFORMANCE_CONSTANTS.TILE_LOAD_THROTTLE_MS * 2
      : PERFORMANCE_CONSTANTS.TILE_LOAD_THROTTLE_MS;
    
    this.currentConfig = newConfig;
    return newConfig;
  }

  /**
   * Obtient la configuration actuelle
   */
  static getCurrentConfig(): typeof this.currentConfig {
    return { ...this.currentConfig };
  }

  /**
   * Réinitialise la configuration aux valeurs par défaut
   */
  static resetToDefaults(): void {
    this.currentConfig = {
      enableClustering: true,
      clusterRadius: 50,
      maxMarkersWithoutClustering: PERFORMANCE_CONSTANTS.MAX_MARKERS_WITHOUT_CLUSTERING,
      tileLoadThrottle: PERFORMANCE_CONSTANTS.TILE_LOAD_THROTTLE_MS,
      enableHighDPI: true,
      enableAnimations: true,
    };
  }
}

// ===========================
// EXPORTS PRINCIPAUX
// ===========================

export const PerformanceOptimizations = {
  Constants: PERFORMANCE_CONSTANTS,
  MemoryManager: MemoryManager.getInstance(),
  FrameRateManager: new FrameRateManager(),
  RenderOptimizer,
  ClusterOptimizer,
  ThrottleUtils,
  AdaptiveConfig,
};

export default PerformanceOptimizations;
