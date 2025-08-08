// src/CustomMapView.tsx - Version simplifiée et fonctionnelle
import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { MapViewProps, MapRegion } from './types';
import TileLayer from './components/TileLayer';
import MarkerComponent from './components/MarkerComponent';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Utility functions
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const latLonToTile = (lat: number, lon: number, zoom: number) => {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2) * n);
  return { x, y };
};

const tileToLatLon = (x: number, y: number, zoom: number) => {
  const n = Math.pow(2, zoom);
  const lon = (x / n) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180 / Math.PI;
  return { lat, lon };
};

const CustomMapView: React.FC<MapViewProps> = ({
  style = {},
  center,
  zoom,
  minZoom = 1,
  maxZoom = 18,
  tileUrlTemplate,
  onRegionChange,
  onMapPress,
  onMapReady,
  markers = [],
  tileSize = 256,
  ...props
}) => {
  // Map region state - CORRIGÉ: latitude = center[1], longitude = center[0]
  const [currentRegion, setCurrentRegion] = useState<MapRegion>({
    latitude: center[1],  // center[1] = latitude
    longitude: center[0], // center[0] = longitude
    zoom: clamp(zoom, minZoom, maxZoom),
  });

  // Pan state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<View>(null);

  // Update region when props change
  useEffect(() => {
    setCurrentRegion({
      latitude: center[1],
      longitude: center[0],
      zoom: clamp(zoom, minZoom, maxZoom),
    });
    setPanOffset({ x: 0, y: 0 });
  }, [center, zoom, minZoom, maxZoom]);

  // Calculate marker screen position
  const calculateMarkerPosition = useCallback((markerCoord: [number, number]) => {
    const markerLat = markerCoord[1]; // markerCoord[1] = latitude
    const markerLon = markerCoord[0]; // markerCoord[0] = longitude
    
    const centerTile = latLonToTile(currentRegion.latitude, currentRegion.longitude, currentRegion.zoom);
    const markerTile = latLonToTile(markerLat, markerLon, currentRegion.zoom);
    
    const deltaX = (markerTile.x - centerTile.x) * tileSize;
    const deltaY = (markerTile.y - centerTile.y) * tileSize;
    
    return {
      x: screenWidth / 2 + deltaX + panOffset.x,
      y: screenHeight / 2 + deltaY + panOffset.y,
    };
  }, [currentRegion, tileSize, panOffset]);

  // Handle pan gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        // Mettre à jour le pan offset pendant le geste
        setPanOffset({
          x: gestureState.dx,
          y: gestureState.dy,
        });
      },
      
      onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        // Calculer la nouvelle position du centre
        const deltaX = -gestureState.dx / tileSize;
        const deltaY = -gestureState.dy / tileSize;
        
        const centerTile = latLonToTile(currentRegion.latitude, currentRegion.longitude, currentRegion.zoom);
        const newCenterTile = {
          x: centerTile.x + deltaX,
          y: centerTile.y + deltaY,
        };
        
        const newCenter = tileToLatLon(newCenterTile.x, newCenterTile.y, currentRegion.zoom);
        
        const newRegion = {
          latitude: newCenter.lat,
          longitude: newCenter.lon,
          zoom: currentRegion.zoom,
        };
        
        setCurrentRegion(newRegion);
        setPanOffset({ x: 0, y: 0 });
        
        // Notifier le changement
        onRegionChange?.(newRegion);
        console.log('Région changée:', newRegion);
      },
      
      onPanResponderGrant: () => {
        // Reset pan offset when gesture starts
        setPanOffset({ x: 0, y: 0 });
      },
    })
  ).current;

  // Handle map press
  const handleMapPress = useCallback((evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    
    // Convert screen coordinates to geographic coordinates
    const deltaX = (locationX - screenWidth / 2 - panOffset.x) / tileSize;
    const deltaY = (locationY - screenHeight / 2 - panOffset.y) / tileSize;
    
    const centerTile = latLonToTile(currentRegion.latitude, currentRegion.longitude, currentRegion.zoom);
    const targetTile = {
      x: centerTile.x + deltaX,
      y: centerTile.y + deltaY,
    };
    
    const targetLatLon = tileToLatLon(targetTile.x, targetTile.y, currentRegion.zoom);
    const coordinates: [number, number] = [targetLatLon.lon, targetLatLon.lat];
    
    onMapPress?.(coordinates);
    console.log('Carte pressée à:', coordinates);
  }, [currentRegion, tileSize, panOffset, onMapPress]);

  // Notify map ready
  useEffect(() => {
    const timer = setTimeout(() => {
      onMapReady?.();
      console.log('✅ Map ready!');
    }, 100);
    
    return () => clearTimeout(timer);
  }, [onMapReady]);

  return (
    <View 
      ref={containerRef}
      style={[styles.container, style]} 
      {...panResponder.panHandlers}
      onStartShouldSetResponder={() => true}
      onResponderGrant={handleMapPress}
    >
      {/* Tile Layer */}
      <TileLayer
        center={[currentRegion.longitude + (panOffset.x / tileSize) * (360 / Math.pow(2, currentRegion.zoom)), 
                 currentRegion.latitude - (panOffset.y / tileSize) * (360 / Math.pow(2, currentRegion.zoom))]}
        zoom={currentRegion.zoom}
        tileUrlTemplate={tileUrlTemplate}
        tileSize={tileSize}
      />
      
      {/* Markers */}
      {markers.map((marker, index) => {
        const position = calculateMarkerPosition(marker.coordinate);
        
        return (
          <MarkerComponent
            key={marker.id || index}
            {...marker}
            screenX={position.x}
            screenY={position.y}
            isVisible={
              position.x >= -50 && 
              position.x <= screenWidth + 50 && 
              position.y >= -50 && 
              position.y <= screenHeight + 50
            }
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8E8E8',
    overflow: 'hidden',
  },
});

export default memo(CustomMapView);
