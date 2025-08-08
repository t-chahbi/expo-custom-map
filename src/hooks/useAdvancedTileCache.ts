// src/hooks/useAdvancedTileCache.ts - Cache intelligent pour tuiles ultra-fluide
import { useRef, useCallback, useMemo, useEffect } from 'react';

interface TileCacheEntry {
  data: string;
  timestamp: number;
  accessCount: number;
  size: number;
  priority: number;
}

interface CacheConfig {
  maxSize?: number; // MB
  maxEntries?: number;
  maxAge?: number; // ms
  preloadRadius?: number;
  enableCompression?: boolean;
}

interface TileRequest {
  url: string;
  priority: number;
  callback: (data: string | null, error?: Error) => void;
}

export const useAdvancedTileCache = (config: CacheConfig = {}) => {
  const {
    maxSize = 100, // 100MB
    maxEntries = 1000,
    maxAge = 30 * 60 * 1000, // 30 minutes
    preloadRadius = 2,
    enableCompression = true,
  } = config;

  // Cache principal
  const cache = useRef(new Map<string, TileCacheEntry>()).current;
  const cacheSize = useRef(0); // Taille en bytes
  const requestQueue = useRef<TileRequest[]>([]);
  const activeRequests = useRef(new Set<string>());
  const maxConcurrentRequests = 6;

  // Worker pour les téléchargements
  const downloadWorker = useRef<{
    isRunning: boolean;
    process: () => Promise<void>;
  } | null>(null);

  // Calculer la clé de cache
  const getCacheKey = useCallback((url: string): string => {
    return url.replace(/[^a-zA-Z0-9]/g, '_');
  }, []);

  // Estimer la taille d'une image
  const estimateImageSize = useCallback((data: string): number => {
    // Estimation basée sur la longueur de l'URL de données
    return data.length * 0.75; // Base64 overhead
  }, []);

  // Nettoyer le cache selon la stratégie LRU améliorée
  const cleanup = useCallback(() => {
    const now = Date.now();
    const entries = Array.from(cache.entries());
    
    // Supprimer les entrées expirées
    const expiredKeys = entries
      .filter(([, entry]) => now - entry.timestamp > maxAge)
      .map(([key]) => key);
    
    expiredKeys.forEach(key => {
      const entry = cache.get(key);
      if (entry) {
        cacheSize.current -= entry.size;
        cache.delete(key);
      }
    });

    // Si encore trop grand, appliquer LRU avec priorité
    if (cache.size > maxEntries || cacheSize.current > maxSize * 1024 * 1024) {
      const remainingEntries = Array.from(cache.entries())
        .filter(([key]) => !expiredKeys.includes(key));
      
      // Trier par score (fréquence d'utilisation + récence + priorité)
      remainingEntries.sort(([, a], [, b]) => {
        const scoreA = a.accessCount * (1 / (now - a.timestamp)) * a.priority;
        const scoreB = b.accessCount * (1 / (now - b.timestamp)) * b.priority;
        return scoreA - scoreB;
      });

      // Supprimer les moins intéressants
      const toDelete = remainingEntries.slice(0, Math.floor(remainingEntries.length * 0.3));
      toDelete.forEach(([key, entry]) => {
        cacheSize.current -= entry.size;
        cache.delete(key);
      });
    }
  }, [cache, maxAge, maxEntries, maxSize]);

  // Obtenir une tuile du cache
  const getTile = useCallback((url: string): string | null => {
    const key = getCacheKey(url);
    const entry = cache.get(key);
    
    if (!entry) return null;
    
    // Vérifier l'âge
    if (Date.now() - entry.timestamp > maxAge) {
      cache.delete(key);
      cacheSize.current -= entry.size;
      return null;
    }
    
    // Mettre à jour les statistiques d'accès
    entry.accessCount++;
    entry.timestamp = Date.now();
    
    return entry.data;
  }, [getCacheKey, cache, maxAge]);

  // Ajouter une tuile au cache
  const cacheTile = useCallback((url: string, data: string, priority = 1) => {
    const key = getCacheKey(url);
    const size = estimateImageSize(data);
    
    // Nettoyer si nécessaire avant d'ajouter
    if (cache.size >= maxEntries || cacheSize.current + size > maxSize * 1024 * 1024) {
      cleanup();
    }
    
    cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      size,
      priority,
    });
    
    cacheSize.current += size;
  }, [getCacheKey, estimateImageSize, cache, maxEntries, maxSize, cleanup]);

  // Télécharger une tuile avec gestion intelligente de la file
  const downloadTile = useCallback(async (url: string, priority = 1): Promise<string | null> => {
    // Vérifier le cache d'abord
    const cached = getTile(url);
    if (cached) return cached;
    
    // Éviter les requêtes dupliquées
    if (activeRequests.current.has(url)) {
      return new Promise((resolve) => {
        const checkCache = () => {
          const result = getTile(url);
          if (result) {
            resolve(result);
          } else {
            setTimeout(checkCache, 50);
          }
        };
        checkCache();
      });
    }
    
    activeRequests.current.add(url);
    
    try {
      // Téléchargement avec timeout et retry
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, { 
        signal: controller.signal,
        cache: 'force-cache',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      // Mettre en cache
      cacheTile(url, dataUrl, priority);
      
      return dataUrl;
      
    } catch (error) {
      console.warn('Failed to load tile:', url, error);
      return null;
    } finally {
      activeRequests.current.delete(url);
    }
  }, [getTile, cacheTile]);

  // Worker de téléchargement en arrière-plan
  useEffect(() => {
    const worker = {
      isRunning: false,
      process: async () => {
        if (worker.isRunning) return;
        worker.isRunning = true;
        
        while (requestQueue.current.length > 0 && activeRequests.current.size < maxConcurrentRequests) {
          // Trier par priorité
          requestQueue.current.sort((a, b) => b.priority - a.priority);
          
          const request = requestQueue.current.shift();
          if (!request) break;
          
          try {
            const result = await downloadTile(request.url, request.priority);
            request.callback(result);
          } catch (error) {
            request.callback(null, error as Error);
          }
        }
        
        worker.isRunning = false;
        
        // Continuer si il y a encore des requêtes
        if (requestQueue.current.length > 0) {
          setTimeout(() => worker.process(), 100);
        }
      }
    };
    
    downloadWorker.current = worker;
  }, [downloadTile]);

  // Précharger des tuiles de manière intelligente
  const preloadTiles = useCallback((urls: string[], priority = 0.5) => {
    urls.forEach(url => {
      if (!getTile(url) && !activeRequests.current.has(url)) {
        requestQueue.current.push({
          url,
          priority,
          callback: () => {}, // Préchargement silencieux
        });
      }
    });
    
    // Démarrer le worker si nécessaire
    if (downloadWorker.current && requestQueue.current.length > 0) {
      downloadWorker.current.process();
    }
  }, [getTile]);

  // Charger une tuile avec priorité
  const loadTile = useCallback((url: string, priority = 1): Promise<string | null> => {
    const cached = getTile(url);
    if (cached) return Promise.resolve(cached);
    
    return new Promise((resolve, reject) => {
      requestQueue.current.push({
        url,
        priority,
        callback: (data, error) => {
          if (error) reject(error);
          else resolve(data);
        },
      });
      
      if (downloadWorker.current) {
        downloadWorker.current.process();
      }
    });
  }, [getTile]);

  // Statistiques du cache
  const getCacheStats = useCallback(() => ({
    entries: cache.size,
    sizeBytes: cacheSize.current,
    sizeMB: (cacheSize.current / (1024 * 1024)).toFixed(2),
    activeRequests: activeRequests.current.size,
    queueLength: requestQueue.current.length,
  }), [cache.size]);

  // Nettoyer périodiquement
  useEffect(() => {
    const interval = setInterval(cleanup, 60000); // Toutes les minutes
    return () => clearInterval(interval);
  }, [cleanup]);

  return {
    getTile,
    loadTile,
    preloadTiles,
    getCacheStats,
    clearCache: () => {
      cache.clear();
      cacheSize.current = 0;
    },
  };
};
