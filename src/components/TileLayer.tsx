// src/components/TileLayer.tsx
import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { TileInfo } from '../types';
import { latLonToTile, tileToLatLon } from '../utils/geoUtils';

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

const TileLayer: React.FC<TileLayerProps> = ({
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

  // Générer l'URL d'une tuile
  const generateTileUrl = useCallback((x: number, y: number, z: number): string => {
    return tileUrlTemplate
      .replace('{x}', x.toString())
      .replace('{y}', y.toString())
      .replace('{z}', z.toString())
      .replace('{s}', ['a', 'b', 'c'][Math.abs(x + y) % 3]); // Sous-domaines
  }, [tileUrlTemplate]);

  // Calculer les tuiles visibles
  const calculateVisibleTiles = useCallback(() => {
    const centerTile = latLonToTile(center[1], center[0], zoom);
    const tilesPerScreen = Math.ceil(Math.max(screenWidth, screenHeight) / tileSize) + preloadRadius;
    
    const newVisibleTiles: TileInfo[] = [];
    const minX = centerTile.x - tilesPerScreen;
    const maxX = centerTile.x + tilesPerScreen;
    const minY = centerTile.y - tilesPerScreen;
    const maxY = centerTile.y + tilesPerScreen;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Vérifier que les coordonnées de tuile sont valides
        const maxTileIndex = Math.pow(2, zoom) - 1;
        if (x >= 0 && x <= maxTileIndex && y >= 0 && y <= maxTileIndex) {
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
    }

    setVisibleTiles(newVisibleTiles);
  }, [center, zoom, tileSize, preloadRadius, generateTileUrl]);

  // Charger une tuile
  const loadTile = useCallback(async (tile: TileInfo) => {
    const tileKey = `${tile.z}-${tile.x}-${tile.y}`;
    
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
      // Précharger l'image
      await new Promise<void>((resolve, reject) => {
        Image.prefetch(tile.url)
          .then(() => {
            tileCache.current.set(tileKey, tile.url);
            
            setTiles(prev => new Map(prev).set(tileKey, {
              loading: false,
              loaded: true,
              error: false,
              url: tile.url,
            }));

            onTileLoad?.(tile);
            resolve();
          })
          .catch(reject);
      });

      // Gérer la taille du cache
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

  // Calculer la position d'une tuile à l'écran
  const getTileScreenPosition = useCallback((tile: TileInfo) => {
    const centerTile = latLonToTile(center[1], center[0], zoom);
    const centerLatLon = tileToLatLon(centerTile.x, centerTile.y, zoom);
    
    // Décalage en tuiles par rapport au centre
    const deltaX = tile.x - centerTile.x;
    const deltaY = tile.y - centerTile.y;
    
    // Position à l'écran
    const screenX = screenWidth / 2 + deltaX * tileSize;
    const screenY = screenHeight / 2 + deltaY * tileSize;
    
    return { x: screenX, y: screenY };
  }, [center, zoom, tileSize]);

  // Effet pour recalculer les tuiles visibles
  useEffect(() => {
    calculateVisibleTiles();
  }, [calculateVisibleTiles]);

  // Effet pour charger les tuiles visibles
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

export default memo(TileLayer);