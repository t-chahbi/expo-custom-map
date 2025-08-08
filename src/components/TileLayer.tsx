// src/components/TileLayerFixed.tsx
import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
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

interface TileState {
  loading: boolean;
  loaded: boolean;
  error: boolean;
  url: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Utility functions
const latLonToTile = (lat: number, lon: number, zoom: number) => {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2) * n);
  return { x, y };
};

const TileLayerFixed: React.FC<TileLayerProps> = ({
  center,
  zoom,
  tileUrlTemplate,
  tileSize = 256,
  enableHighDPI = true,
  onTileLoad,
  onTileError,
  cacheSize = 100,
  preloadRadius = 1,
}) => {
  const [tiles, setTiles] = useState<Map<string, TileState>>(new Map());
  const [visibleTiles, setVisibleTiles] = useState<TileInfo[]>([]);
  const tileCache = useRef<Map<string, string>>(new Map());
  const loadingTiles = useRef<Set<string>>(new Set());

  // Generate tile URL
  const generateTileUrl = useCallback((x: number, y: number, z: number): string => {
    let url = tileUrlTemplate
      .replace('{x}', x.toString())
      .replace('{y}', y.toString())
      .replace('{z}', z.toString());
    
    // Handle subdomain replacement
    if (url.includes('{s}')) {
      const subdomains = ['a', 'b', 'c'];
      const subdomain = subdomains[Math.abs(x + y) % subdomains.length];
      url = url.replace('{s}', subdomain);
    }
    
    return url;
  }, [tileUrlTemplate]);

  // Calculate visible tiles with improved boundary checking
  const calculateVisibleTiles = useCallback(() => {
    const [lon, lat] = center;
    const centerTile = latLonToTile(lat, lon, zoom);
    
    // Calculate how many tiles we need to cover the screen
    const tilesPerScreenX = Math.ceil(screenWidth / tileSize) + preloadRadius * 2;
    const tilesPerScreenY = Math.ceil(screenHeight / tileSize) + preloadRadius * 2;
    
    const newVisibleTiles: TileInfo[] = [];
    const maxTileIndex = Math.pow(2, zoom) - 1;
    
    const minX = Math.max(0, centerTile.x - Math.ceil(tilesPerScreenX / 2));
    const maxX = Math.min(maxTileIndex, centerTile.x + Math.ceil(tilesPerScreenX / 2));
    const minY = Math.max(0, centerTile.y - Math.ceil(tilesPerScreenY / 2));
    const maxY = Math.min(maxTileIndex, centerTile.y + Math.ceil(tilesPerScreenY / 2));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const url = generateTileUrl(x, y, zoom);
        newVisibleTiles.push({
          x,
          y,
          z: zoom,
          url,
          size: tileSize,
          timestamp: Date.now(),
        });
      }
    }

    setVisibleTiles(newVisibleTiles);
  }, [center, zoom, tileSize, preloadRadius, generateTileUrl]);

  // Load tile with better error handling
  const loadTile = useCallback(async (tile: TileInfo) => {
    const tileKey = `${tile.z}-${tile.x}-${tile.y}`;
    
    // Skip if already loading or loaded
    if (loadingTiles.current.has(tileKey) || tileCache.current.has(tileKey)) {
      return;
    }

    loadingTiles.current.add(tileKey);

    setTiles(prev => new Map(prev).set(tileKey, {
      loading: true,
      loaded: false,
      error: false,
      url: tile.url,
    }));

    try {
      // Preload the image with timeout
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Tile load timeout')), 10000);
        
        Image.prefetch(tile.url)
          .then(() => {
            clearTimeout(timeout);
            resolve();
          })
          .catch(reject);
      });

      await loadPromise;

      tileCache.current.set(tileKey, tile.url);
      
      setTiles(prev => new Map(prev).set(tileKey, {
        loading: false,
        loaded: true,
        error: false,
        url: tile.url,
      }));

      onTileLoad?.(tile);

      // Manage cache size
      if (tileCache.current.size > cacheSize) {
        const oldestKey = tileCache.current.keys().next().value;
        if (oldestKey) {
          tileCache.current.delete(oldestKey);
          setTiles(prev => {
            const newTiles = new Map(prev);
            newTiles.delete(oldestKey);
            return newTiles;
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to load tile ${tileKey}:`, error);
      
      setTiles(prev => new Map(prev).set(tileKey, {
        loading: false,
        loaded: false,
        error: true,
        url: tile.url,
      }));

      onTileError?.(tile, error as Error);
    } finally {
      loadingTiles.current.delete(tileKey);
    }
  }, [cacheSize, onTileLoad, onTileError]);

  // Calculate tile screen position with improved accuracy
  const getTileScreenPosition = useCallback((tile: TileInfo) => {
    const [lon, lat] = center;
    const centerTile = latLonToTile(lat, lon, zoom);
    
    // Calculate offset in tiles from center
    const deltaX = tile.x - centerTile.x;
    const deltaY = tile.y - centerTile.y;
    
    // Convert to screen position
    const screenX = screenWidth / 2 + deltaX * tileSize - tileSize / 2;
    const screenY = screenHeight / 2 + deltaY * tileSize - tileSize / 2;
    
    return { x: screenX, y: screenY };
  }, [center, zoom, tileSize]);

  // Update visible tiles when dependencies change
  useEffect(() => {
    calculateVisibleTiles();
  }, [calculateVisibleTiles]);

  // Load visible tiles
  useEffect(() => {
    visibleTiles.forEach(tile => {
      loadTile(tile);
    });
  }, [visibleTiles, loadTile]);

  return (
    <View style={styles.container}>
      {visibleTiles.map(tile => {
        const tileKey = `${tile.z}-${tile.x}-${tile.y}`;
        const tileState = tiles.get(tileKey);
        const position = getTileScreenPosition(tile);
        
        // Only render loaded tiles
        if (!tileState?.loaded) {
          return null;
        }

        return (
          <Image
            key={tileKey}
            source={{ uri: tile.url }}
            style={[
              styles.tile,
              {
                left: position.x,
                top: position.y,
                width: tileSize,
                height: tileSize,
              },
            ]}
            resizeMode="cover"
          />
        );
      })}
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
});

export default memo(TileLayerFixed);
