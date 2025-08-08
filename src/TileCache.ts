// src/TileCache.ts
import { TileInfo, CacheStats } from './types';

// Import conditionnel d'AsyncStorage
let AsyncStorage: any;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (error) {
  // AsyncStorage n'est pas disponible (environnement Node.js, etc.)
  console.warn('AsyncStorage not available, cache will be memory-only');
  AsyncStorage = undefined;
}

interface CachedTile {
  url: string;
  data: string;
  size: number;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

export class TileCache {
  private cache = new Map<string, CachedTile>();
  private maxSizeMB: number;
  private maxAge: number;
  private persistent: boolean;
  private storagePrefix = '@expo-custom-map/tiles/';

  constructor(maxSizeMB: number = 100, maxAge: number = 7 * 24 * 60 * 60 * 1000, persistent: boolean = true) {
    this.maxSizeMB = maxSizeMB;
    this.maxAge = maxAge;
    
    // Vérifier si nous sommes dans un environnement React Native
    const isReactNativeEnvironment = typeof window !== 'undefined' && 
                                    (window as any).navigator?.product === 'ReactNative';
    
    this.persistent = persistent && isReactNativeEnvironment;
    
    if (this.persistent) {
      this.loadFromStorage().catch((error) => {
        console.warn('Erreur lors du chargement du cache de tuiles:', error);
        // En cas d'erreur, désactiver la persistance pour cette session
        this.persistent = false;
      });
    }
  }

  /**
   * Créer un cache en mode mémoire uniquement (sans persistance)
   * Utile pour les environnements de test ou non-React Native
   */
  static createMemoryOnlyCache(maxSizeMB: number = 100, maxAge: number = 7 * 24 * 60 * 60 * 1000): TileCache {
    return new TileCache(maxSizeMB, maxAge, false);
  }

  /**
   * Générer une clé de cache pour une tuile
   */
  private getTileKey(x: number, y: number, z: number): string {
    return `${z}-${x}-${y}`;
  }

  /**
   * Calculer la taille actuelle du cache en MB
   */
  private getCurrentSizeMB(): number {
    let totalSize = 0;
    for (const tile of this.cache.values()) {
      totalSize += tile.size;
    }
    return totalSize / (1024 * 1024);
  }

  /**
   * Nettoyer le cache selon la politique LRU
   */
  private cleanup(): void {
    const now = Date.now();
    const maxSizeBytes = this.maxSizeMB * 1024 * 1024;
    
    // Supprimer les tuiles expirées
    for (const [key, tile] of this.cache.entries()) {
      if (now - tile.timestamp > this.maxAge) {
        this.cache.delete(key);
        if (this.persistent) {
          AsyncStorage.removeItem(this.storagePrefix + key).catch(() => {});
        }
      }
    }
    
    // Si toujours trop gros, supprimer les moins récemment utilisées
    let currentSize = 0;
    for (const tile of this.cache.values()) {
      currentSize += tile.size;
    }
    
    if (currentSize > maxSizeBytes) {
      const sortedTiles = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.lastAccess - b.lastAccess
      );
      
      for (const [key, tile] of sortedTiles) {
        this.cache.delete(key);
        currentSize -= tile.size;
        
        if (this.persistent) {
          AsyncStorage.removeItem(this.storagePrefix + key).catch(() => {});
        }
        
        if (currentSize <= maxSizeBytes * 0.8) { // Nettoyer jusqu'à 80% pour éviter le thrashing
          break;
        }
      }
    }
  }

  /**
   * Charger le cache depuis le stockage persistant
   */
  private async loadFromStorage(): Promise<void> {
    if (!this.persistent) {
      return;
    }
    
    try {
      // Vérifier si AsyncStorage est disponible
      if (typeof AsyncStorage === 'undefined') {
        throw new Error('AsyncStorage is not available');
      }
      
      const keys = await AsyncStorage.getAllKeys();
      const tileKeys = keys.filter((key: string) => key.startsWith(this.storagePrefix));
      
      const items = await AsyncStorage.multiGet(tileKeys);
      
      for (const [key, value] of items) {
        if (value) {
          try {
            const cachedTile: CachedTile = JSON.parse(value);
            const tileKey = key.replace(this.storagePrefix, '');
            
            // Vérifier si la tuile n'est pas expirée
            if (Date.now() - cachedTile.timestamp <= this.maxAge) {
              this.cache.set(tileKey, cachedTile);
            } else {
              // Supprimer la tuile expirée
              AsyncStorage.removeItem(key).catch(() => {});
            }
          } catch (error) {
            // Supprimer les données corrompues
            AsyncStorage.removeItem(key).catch(() => {});
          }
        }
      }
    } catch (error) {
      console.warn('Erreur lors du chargement du cache de tuiles:', error);
    }
  }

  /**
   * Sauvegarder une tuile dans le stockage persistant
   */
  private async saveToStorage(key: string, tile: CachedTile): Promise<void> {
    if (!this.persistent) return;
    
    try {
      // Vérifier si AsyncStorage est disponible
      if (typeof AsyncStorage === 'undefined') {
        return;
      }
      
      await AsyncStorage.setItem(
        this.storagePrefix + key,
        JSON.stringify(tile)
      );
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde de la tuile:', error);
    }
  }

  /**
   * Ajouter une tuile au cache
   */
  async set(tile: TileInfo, data: string): Promise<void> {
    const key = this.getTileKey(tile.x, tile.y, tile.z);
    const size = data.length;
    const now = Date.now();
    
    const cachedTile: CachedTile = {
      url: tile.url,
      data,
      size,
      timestamp: now,
      accessCount: 1,
      lastAccess: now,
    };
    
    this.cache.set(key, cachedTile);
    
    // Sauvegarder de manière asynchrone
    if (this.persistent) {
      this.saveToStorage(key, cachedTile).catch(() => {});
    }
    
    // Nettoyer si nécessaire
    this.cleanup();
  }

  /**
   * Récupérer une tuile du cache
   */
  get(x: number, y: number, z: number): string | null {
    const key = this.getTileKey(x, y, z);
    const tile = this.cache.get(key);
    
    if (tile) {
      // Mettre à jour les statistiques d'accès
      tile.accessCount++;
      tile.lastAccess = Date.now();
      return tile.data;
    }
    
    return null;
  }

  /**
   * Vérifier si une tuile existe dans le cache
   */
  has(x: number, y: number, z: number): boolean {
    const key = this.getTileKey(x, y, z);
    return this.cache.has(key);
  }

  /**
   * Supprimer une tuile du cache
   */
  async delete(x: number, y: number, z: number): Promise<void> {
    const key = this.getTileKey(x, y, z);
    this.cache.delete(key);
    
    if (this.persistent) {
      try {
        await AsyncStorage.removeItem(this.storagePrefix + key);
      } catch (error) {
        console.warn('Erreur lors de la suppression de la tuile:', error);
      }
    }
  }

  /**
   * Vider tout le cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    
    if (this.persistent) {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const tileKeys = keys.filter((key: string) => key.startsWith(this.storagePrefix));
        await AsyncStorage.multiRemove(tileKeys);
      } catch (error) {
        console.warn('Erreur lors de la suppression du cache:', error);
      }
    }
  }

  /**
   * Obtenir les statistiques du cache
   */
  getStats(): CacheStats {
    const currentSizeMB = this.getCurrentSizeMB();
    
    let totalRequests = 0;
    let totalHits = 0;
    
    for (const tile of this.cache.values()) {
      totalRequests += tile.accessCount;
      totalHits += tile.accessCount;
    }
    
    return {
      size: this.cache.size,
      currentSizeMB: Math.round(currentSizeMB * 100) / 100,
      maxSizeMB: this.maxSizeMB,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
    };
  }

  /**
   * Définir la taille maximale du cache
   */
  setMaxSize(maxSizeMB: number): void {
    this.maxSizeMB = maxSizeMB;
    this.cleanup();
  }

  /**
   * Définir l'âge maximum des tuiles
   */
  setMaxAge(maxAge: number): void {
    this.maxAge = maxAge;
    this.cleanup();
  }

  /**
   * Précharger une zone de tuiles
   */
  async preloadArea(
    bounds: { minX: number; maxX: number; minY: number; maxY: number; z: number },
    urlTemplate: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    const { minX, maxX, minY, maxY, z } = bounds;
    const total = (maxX - minX + 1) * (maxY - minY + 1);
    let loaded = 0;
    
    const promises: Promise<void>[] = [];
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (!this.has(x, y, z)) {
          const url = urlTemplate
            .replace('{x}', x.toString())
            .replace('{y}', y.toString())
            .replace('{z}', z.toString());
          
          const promise = fetch(url)
            .then(response => response.text())
            .then(data => {
              const tile: TileInfo = { x, y, z, url };
              return this.set(tile, data);
            })
            .then(() => {
              loaded++;
              onProgress?.(loaded, total);
            })
            .catch(error => {
              console.warn(`Erreur lors du préchargement de la tuile ${x},${y},${z}:`, error);
              loaded++;
              onProgress?.(loaded, total);
            });
          
          promises.push(promise);
        } else {
          loaded++;
          onProgress?.(loaded, total);
        }
      }
    }
    
    await Promise.all(promises);
  }
}