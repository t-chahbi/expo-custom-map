// src/CustomMapView.tsx
import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { View, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { MapViewProps, MapRegion, MarkerProps } from './types';
import TileLayer from './components/TileLayer';
import MarkerComponent from './components/MarkerComponent';
import ClusterMarker from './components/ClusterMarker';
import useOptimizedGestures from './hooks/useOptimizedGestures';
import { latLonToTile, tileToLatLon, clamp } from './utils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  showUserLocation = false,
  followUserLocation = false,
  enableClustering = false,
  clusterRadius = 50,
  offlineTileProvider,
  enableHighDPI = true,
  tileSize = 256,
  cacheSize = 100,
  ...props
}) => {
  // État de la région de la carte
  const [currentRegion, setCurrentRegion] = useState<MapRegion>({
    latitude: center[1],
    longitude: center[0],
    zoom: clamp(zoom, minZoom, maxZoom),
  });

  // Références pour la gestion des gestes
  const containerRef = useRef<View>(null);
  const lastPinchScale = useRef(1);
  const lastPanDelta = useRef({ x: 0, y: 0 });

  // Hook pour la gestion optimisée des gestes
  const {
    throttledRegionChange,
    debouncedRegionChange,
    setRegion,
    calculateNewRegion,
  } = useOptimizedGestures(
    currentRegion,
    onRegionChange,
    {
      minZoom,
      maxZoom,
      enablePan: true,
      enableZoom: true,
    }
  );

  // Convertir les coordonnées géographiques en coordonnées d'écran
  const coordinateToScreen = useCallback((coordinate: [number, number]): { x: number; y: number } => {
    const [lon, lat] = coordinate;
    const { latitude, longitude, zoom: currentZoom } = currentRegion;
    
    // Calculer la distance en pixels par rapport au centre
    const centerTile = latLonToTile(latitude, longitude, currentZoom);
    const pointTile = latLonToTile(lat, lon, currentZoom);
    
    const deltaX = (pointTile.x - centerTile.x) * tileSize;
    const deltaY = (pointTile.y - centerTile.y) * tileSize;
    
    const screenX = screenWidth / 2 + deltaX;
    const screenY = screenHeight / 2 + deltaY;
    
    return { x: screenX, y: screenY };
  }, [currentRegion, tileSize]);

  // Convertir les coordonnées d'écran en coordonnées géographiques
  const screenToCoordinate = useCallback((screenPoint: { x: number; y: number }): [number, number] => {
    const { latitude, longitude, zoom: currentZoom } = currentRegion;
    
    const deltaX = (screenPoint.x - screenWidth / 2) / tileSize;
    const deltaY = (screenPoint.y - screenHeight / 2) / tileSize;
    
    const centerTile = latLonToTile(latitude, longitude, currentZoom);
    const targetTile = {
      x: centerTile.x + deltaX,
      y: centerTile.y + deltaY,
    };
    
    const targetLatLon = tileToLatLon(targetTile.x, targetTile.y, currentZoom);
    return [targetLatLon.lon, targetLatLon.lat];
  }, [currentRegion, tileSize]);

  // Gestionnaire de gestes pan
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        lastPanDelta.current = { x: 0, y: 0 };
      },
      onPanResponderMove: (evt, gestureState) => {
        const deltaX = gestureState.dx - lastPanDelta.current.x;
        const deltaY = gestureState.dy - lastPanDelta.current.y;
        
        const newRegion = calculateNewRegion(deltaX, deltaY, 1);
        setCurrentRegion(newRegion);
        throttledRegionChange(newRegion);
        
        lastPanDelta.current = { x: gestureState.dx, y: gestureState.dy };
      },
      onPanResponderRelease: () => {
        debouncedRegionChange(currentRegion);
      },
    })
  ).current;

  // Gestionnaire de pression sur la carte
  const handleMapPress = useCallback((event: any) => {
    if (onMapPress) {
      const { locationX, locationY } = event.nativeEvent;
      const coordinate = screenToCoordinate({ x: locationX, y: locationY });
      onMapPress(coordinate);
    }
  }, [onMapPress, screenToCoordinate]);

  // Clustering des marqueurs
  const processedMarkers = useCallback(() => {
    if (!enableClustering || markers.length === 0) {
      return markers.map(marker => ({
        ...marker,
        screenPosition: coordinateToScreen(marker.coordinate),
      }));
    }

    // Algorithme simple de clustering
    const clusters: any[] = [];
    const processed = new Set<number>();
    
    markers.forEach((marker, index) => {
      if (processed.has(index)) return;
      
      const screenPos = coordinateToScreen(marker.coordinate);
      const cluster = {
        coordinate: marker.coordinate,
        markers: [marker],
        screenPosition: screenPos,
      };
      
      // Chercher les marqueurs proches
      for (let i = index + 1; i < markers.length; i++) {
        if (processed.has(i)) continue;
        
        const otherScreenPos = coordinateToScreen(markers[i].coordinate);
        const distance = Math.sqrt(
          Math.pow(screenPos.x - otherScreenPos.x, 2) +
          Math.pow(screenPos.y - otherScreenPos.y, 2)
        );
        
        if (distance < clusterRadius) {
          cluster.markers.push(markers[i]);
          processed.add(i);
        }
      }
      
      clusters.push(cluster);
      processed.add(index);
    });
    
    return clusters;
  }, [markers, enableClustering, clusterRadius, coordinateToScreen]);

  // Mettre à jour la région quand les props changent
  useEffect(() => {
    const newRegion = {
      latitude: center[1],
      longitude: center[0],
      zoom: clamp(zoom, minZoom, maxZoom),
    };
    setCurrentRegion(newRegion);
    setRegion(newRegion);
  }, [center, zoom, minZoom, maxZoom, setRegion]);

  // Notifier quand la carte est prête
  useEffect(() => {
    if (onMapReady) {
      const timer = setTimeout(onMapReady, 100);
      return () => clearTimeout(timer);
    }
  }, [onMapReady]);

  const renderMarkers = () => {
    const processed = processedMarkers();
    
    return processed.map((item, index) => {
      if (enableClustering && item.markers && item.markers.length > 1) {
        return (
          <ClusterMarker
            key={`cluster-${index}`}
            coordinate={item.coordinate}
            count={item.markers.length}
            markers={item.markers}
            screenX={item.screenPosition.x}
            screenY={item.screenPosition.y}
            isVisible={
              item.screenPosition.x >= -50 &&
              item.screenPosition.x <= screenWidth + 50 &&
              item.screenPosition.y >= -50 &&
              item.screenPosition.y <= screenHeight + 50
            }
          />
        );
      } else {
        const marker = item.markers ? item.markers[0] : item;
        const screenPos = item.screenPosition || coordinateToScreen(marker.coordinate);
        
        return (
          <MarkerComponent
            key={marker.id || `marker-${index}`}
            {...marker}
            screenX={screenPos.x}
            screenY={screenPos.y}
            isVisible={
              screenPos.x >= -50 &&
              screenPos.x <= screenWidth + 50 &&
              screenPos.y >= -50 &&
              screenPos.y <= screenHeight + 50
            }
          />
        );
      }
    });
  };

  return (
    <View
      ref={containerRef}
      style={[styles.container, style]}
      {...panResponder.panHandlers}
      onTouchEnd={handleMapPress}
      {...props}
    >
      {/* Couche de tuiles */}
      <TileLayer
        center={[currentRegion.longitude, currentRegion.latitude]}
        zoom={currentRegion.zoom}
        tileUrlTemplate={tileUrlTemplate}
        tileSize={tileSize}
        enableHighDPI={enableHighDPI}
        cacheSize={cacheSize}
        preloadRadius={1}
      />
      
      {/* Marqueurs */}
      {renderMarkers()}
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