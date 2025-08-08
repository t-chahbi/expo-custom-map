// src/components/TileLayer.tsx - Version ultra-optimisée pour fluidité maximale
import React, { useState, useCallback, useEffect, memo, useMemo, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions, Animated } from 'react-native';
import { TileInfo } from '../types';

export interface TileLayerProps {
  center: [number, number];
  zoom: number;
  tileUrlTemplate: string;
  tileSize?: number;
  enableHighDPI?: boolean;
  onTileLoad?: (tile: TileInfo) => void;
  onTileError?: (tile: TileInfo, error: Error) => void;
  cacheSize?: number;
  preloadRadius?: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Cache global intelligent pour les tuiles
class TileCache {
  private cache = new Map<string, { data: string; timestamp: number; accessCount: number }>();
  private maxSize = 200; // Nombre maximum de tuiles en cache
  private maxAge = 10 * 60 * 1000; // 10 minutes

  set(key: string, data: string) {
    // Nettoyer le cache si nécessaire
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  get(key: string): string | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Vérifier l'âge
    if (Date.now() - item.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    // Mettre à jour l'utilisation
    item.accessCount++;
    item.timestamp = Date.now();
    
    return item.data;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  private cleanup() {
    // Supprimer les plus anciens et moins utilisés
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => {
      const scoreA = a[1].accessCount * (Date.now() - a[1].timestamp);
      const scoreB = b[1].accessCount * (Date.now() - b[1].timestamp);
      return scoreA - scoreB;
    });
    
    // Supprimer le premier tiers
    const toDelete = entries.slice(0, Math.floor(entries.length / 3));
    toDelete.forEach(([key]) => this.cache.delete(key));
  }
}

// Instance unique du cache
const globalTileCache = new TileCache();

// Utility functions optimisées avec cache
const latLonToTile = (() => {
  const cache = new Map<string, { x: number; y: number }>();
  
  return (lat: number, lon: number, zoom: number) => {
    const key = `${lat.toFixed(6)}-${lon.toFixed(6)}-${zoom}`;
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lon + 180) / 360) * n);
    const y = Math.floor(((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2) * n);
    
    const result = { x, y };
    
    // Limiter la taille du cache
    if (cache.size > 1000) {
      cache.clear();
    }
    cache.set(key, result);
    
    return result;
  };
})();

// Composant Tile optimisé avec loading progressif
const TileComponent = memo<{
  tile: {
    x: number;
    y: number;
    z: number;
    url: string;
    key: string;
    screenX: number;
    screenY: number;
  };
  tileSize: number;
  onLoad?: () => void;
  onError?: () => void;
}>(({ tile, tileSize, onLoad, onError }) => {
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    setImageStatus('loaded');
    onLoad?.();
    
    // Animation de fade-in fluide
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, onLoad]);

  const handleError = useCallback(() => {
    if (!mountedRef.current) return;
    
    setImageStatus('error');
    onError?.();
  }, [onError]);

  const imageStyle = [
    styles.tile,
    {
      width: tileSize,
      height: tileSize,
      left: tile.screenX,
      top: tile.screenY,
      opacity: fadeAnim,
    },
  ];

  return (
    <Animated.View style={imageStyle}>
      <Image
        source={{ uri: tile.url }}
        style={{ width: tileSize, height: tileSize }}
        onLoad={handleLoad}
        onError={handleError}
        resizeMode="cover"
      />
      {imageStatus === 'loading' && (
        <View style={[styles.loadingPlaceholder, { width: tileSize, height: tileSize }]} />
      )}
    </Animated.View>
  );
});

TileComponent.displayName = 'TileComponent';

const TileLayer: React.FC<TileLayerProps> = ({
  center,
  zoom,
  tileUrlTemplate,
  tileSize = 256,
  onTileLoad,
  onTileError,
}) => {
  // États pour la performance
  const [loadedTiles, setLoadedTiles] = useState(new Set<string>());
  const [errorTiles, setErrorTiles] = useState(new Set<string>());
  
  // Refs pour éviter les re-renders
  const lastCalculation = useRef<{
    center: [number, number];
    zoom: number;
    tiles: any[];
  }>({ center: [0, 0], zoom: 0, tiles: [] });
  
  const loadingQueue = useRef(new Set<string>());
  const preloadQueue = useRef<string[]>([]);

  // Generate tile URL avec cache
  const generateTileUrl = useCallback((x: number, y: number, z: number): string => {
    return tileUrlTemplate
      .replace('{x}', x.toString())
      .replace('{y}', y.toString())
      .replace('{z}', z.toString())
      .replace('{s}', ['a', 'b', 'c'][Math.floor(Math.random() * 3)]); // Sous-domaines aléatoires
  }, [tileUrlTemplate]);

  // Calculate visible tiles avec optimisation agressive
  const visibleTiles = useMemo(() => {
    const centerLat = center[1];
    const centerLon = center[0];
    
    // Éviter les recalculs inutiles
    const tolerance = 0.001;
    if (
      Math.abs(lastCalculation.current.center[0] - centerLon) < tolerance &&
      Math.abs(lastCalculation.current.center[1] - centerLat) < tolerance &&
      Math.abs(lastCalculation.current.zoom - zoom) < 0.1
    ) {
      return lastCalculation.current.tiles;
    }
    
    const centerTile = latLonToTile(centerLat, centerLon, zoom);
    
    // Calculer la zone visible avec buffer intelligent
    const bufferTiles = 1; // Tuiles de buffer pour le préchargement
    const tilesPerScreenX = Math.ceil(screenWidth / tileSize) + bufferTiles * 2;
    const tilesPerScreenY = Math.ceil(screenHeight / tileSize) + bufferTiles * 2;
    
    const startX = centerTile.x - Math.floor(tilesPerScreenX / 2);
    const startY = centerTile.y - Math.floor(tilesPerScreenY / 2);
    
    const tiles: Array<{
      x: number;
      y: number;
      z: number;
      url: string;
      key: string;
      screenX: number;
      screenY: number;
      priority: number;
    }> = [];

    const maxTileIndex = Math.pow(2, zoom) - 1;

    for (let x = startX; x < startX + tilesPerScreenX; x++) {
      for (let y = startY; y < startY + tilesPerScreenY; y++) {
        if (x >= 0 && x <= maxTileIndex && y >= 0 && y <= maxTileIndex) {
          const tileUrl = generateTileUrl(x, y, zoom);
          const key = `${zoom}-${x}-${y}`;
          
          // Position sur l'écran
          const screenX = (x - centerTile.x) * tileSize + screenWidth / 2 - tileSize / 2;
          const screenY = (y - centerTile.y) * tileSize + screenHeight / 2 - tileSize / 2;
          
          // Calculer la priorité (centre = priorité haute)
          const distanceFromCenter = Math.sqrt(
            Math.pow(x - centerTile.x, 2) + Math.pow(y - centerTile.y, 2)
          );
          const priority = Math.max(0, 10 - distanceFromCenter);
          
          tiles.push({
            x,
            y,
            z: zoom,
            url: tileUrl,
            key,
            screenX,
            screenY,
            priority,
          });
        }
      }
    }

    // Trier par priorité pour charger le centre en premier
    tiles.sort((a, b) => b.priority - a.priority);
    
    // Mettre en cache le calcul
    lastCalculation.current = {
      center: [centerLon, centerLat],
      zoom,
      tiles,
    };

    return tiles;
  }, [center, zoom, tileSize, generateTileUrl]);

  // Préchargement intelligent des tuiles
  useEffect(() => {
    const preloadTiles = async () => {
      // Précharger uniquement les tuiles visibles non chargées
      const tilesToPreload = visibleTiles
        .filter(tile => !loadedTiles.has(tile.key) && !loadingQueue.current.has(tile.key))
        .slice(0, 6); // Limiter le nombre de téléchargements simultanés

      for (const tile of tilesToPreload) {
        if (globalTileCache.has(tile.key)) {
          setLoadedTiles(prev => new Set(prev).add(tile.key));
          continue;
        }

        loadingQueue.current.add(tile.key);
        
        try {
          // Simuler le préchargement sans bloquer l'UI
          const response = await fetch(tile.url);
          if (response.ok) {
            const blob = await response.blob();
            globalTileCache.set(tile.key, URL.createObjectURL(blob));
            setLoadedTiles(prev => new Set(prev).add(tile.key));
          }
        } catch (error) {
          setErrorTiles(prev => new Set(prev).add(tile.key));
        } finally {
          loadingQueue.current.delete(tile.key);
        }
      }
    };

    // Débouncer le préchargement
    const timer = setTimeout(preloadTiles, 100);
    return () => clearTimeout(timer);
  }, [visibleTiles, loadedTiles]);

  // Handlers optimisés
  const handleTileLoad = useCallback((tileKey: string) => {
    setLoadedTiles(prev => new Set(prev).add(tileKey));
    onTileLoad?.({
      x: parseInt(tileKey.split('-')[1]),
      y: parseInt(tileKey.split('-')[2]),
      z: parseInt(tileKey.split('-')[0]),
    } as TileInfo);
  }, [onTileLoad]);

  const handleTileError = useCallback((tileKey: string) => {
    setErrorTiles(prev => new Set(prev).add(tileKey));
    onTileError?.({
      x: parseInt(tileKey.split('-')[1]),
      y: parseInt(tileKey.split('-')[2]),
      z: parseInt(tileKey.split('-')[0]),
    } as TileInfo, new Error('Failed to load tile'));
  }, [onTileError]);

  // Nettoyer les tuiles hors zone de temps en temps
  useEffect(() => {
    const cleanup = () => {
      const visibleKeys = new Set(visibleTiles.map(t => t.key));
      
      setLoadedTiles(prev => {
        const newSet = new Set<string>();
        prev.forEach(key => {
          if (visibleKeys.has(key)) {
            newSet.add(key);
          }
        });
        return newSet;
      });
      
      setErrorTiles(prev => {
        const newSet = new Set<string>();
        prev.forEach(key => {
          if (visibleKeys.has(key)) {
            newSet.add(key);
          }
        });
        return newSet;
      });
    };

    const timer = setTimeout(cleanup, 5000);
    return () => clearTimeout(timer);
  }, [visibleTiles]);

  return (
    <View style={styles.container}>
      {visibleTiles.map((tile) => (
        <TileComponent
          key={tile.key}
          tile={tile}
          tileSize={tileSize}
          onLoad={() => handleTileLoad(tile.key)}
          onError={() => handleTileError(tile.key)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F5F5F5',
  },
  tile: {
    position: 'absolute',
  },
  loadingPlaceholder: {
    position: 'absolute',
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(TileLayer);
