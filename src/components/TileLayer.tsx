// src/components/TileLayer.tsx
import React, { memo, useEffect, useState, useCallback } from 'react';
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Utility functions
const latLonToTile = (lat: number, lon: number, zoom: number) => {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2) * n);
  return { x, y };
};

const TileLayer: React.FC<TileLayerProps> = ({
  center,
  zoom,
  tileUrlTemplate,
  tileSize = 256,
  onTileLoad,
  onTileError,
}) => {
  const [visibleTiles, setVisibleTiles] = useState<Array<{
    x: number;
    y: number;
    z: number;
    url: string;
    key: string;
    screenX: number;
    screenY: number;
  }>>([]);

  // Generate tile URL
  const generateTileUrl = useCallback((x: number, y: number, z: number): string => {
    return tileUrlTemplate
      .replace('{x}', x.toString())
      .replace('{y}', y.toString())
      .replace('{z}', z.toString());
  }, [tileUrlTemplate]);

  // Calculate visible tiles
  const calculateVisibleTiles = useCallback(() => {
    const centerTile = latLonToTile(center[1], center[0], zoom);
    
    // Calculer combien de tuiles sont nécessaires pour couvrir l'écran
    const tilesPerScreenX = Math.ceil(screenWidth / tileSize) + 2; // +2 pour le buffer
    const tilesPerScreenY = Math.ceil(screenHeight / tileSize) + 2;
    
    const startX = centerTile.x - Math.floor(tilesPerScreenX / 2);
    const startY = centerTile.y - Math.floor(tilesPerScreenY / 2);
    
    const newVisibleTiles: Array<{
      x: number;
      y: number;
      z: number;
      url: string;
      key: string;
      screenX: number;
      screenY: number;
    }> = [];

    for (let x = startX; x < startX + tilesPerScreenX; x++) {
      for (let y = startY; y < startY + tilesPerScreenY; y++) {
        // Vérifier que les coordonnées de tuile sont valides
        const maxTileIndex = Math.pow(2, zoom) - 1;
        if (x >= 0 && x <= maxTileIndex && y >= 0 && y <= maxTileIndex) {
          const tileUrl = generateTileUrl(x, y, zoom);
          const key = `${zoom}-${x}-${y}`;
          
          // Position sur l'écran
          const screenX = (x - centerTile.x) * tileSize + screenWidth / 2 - tileSize / 2;
          const screenY = (y - centerTile.y) * tileSize + screenHeight / 2 - tileSize / 2;
          
          newVisibleTiles.push({
            x,
            y,
            z: zoom,
            url: tileUrl,
            key,
            screenX,
            screenY,
          });
        }
      }
    }

    setVisibleTiles(newVisibleTiles);
  }, [center, zoom, tileSize, generateTileUrl]);

  // Recalculate tiles when center or zoom changes
  useEffect(() => {
    calculateVisibleTiles();
  }, [calculateVisibleTiles]);

  const handleTileLoad = useCallback((tile: any) => {
    onTileLoad?.({
      x: tile.x,
      y: tile.y,
      z: tile.z,
      url: tile.url,
    });
  }, [onTileLoad]);

  const handleTileError = useCallback((tile: any, error: any) => {
    console.warn(`Failed to load tile ${tile.z}-${tile.x}-${tile.y}:`, error);
    onTileError?.({
      x: tile.x,
      y: tile.y,
      z: tile.z,
      url: tile.url,
    }, error);
  }, [onTileError]);

  return (
    <View style={styles.container}>
      {visibleTiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tile.url }}
          style={[
            styles.tile,
            {
              left: tile.screenX,
              top: tile.screenY,
              width: tileSize,
              height: tileSize,
            },
          ]}
          onLoad={() => handleTileLoad(tile)}
          onError={(error) => handleTileError(tile, error)}
          resizeMode="cover"
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
});

export default memo(TileLayer);
