// src/CustomMapView.tsx - Fixed version with performance improvements
import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { MapViewProps, MapRegion } from './types';
import TileLayer from './components/TileLayer';
import MarkerComponent from './components/MarkerComponent';
import ClusterMarker from './components/ClusterMarker';

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
  // Map region state
  const [currentRegion, setCurrentRegion] = useState<MapRegion>({
    latitude: center[1],
    longitude: center[0],
    zoom: clamp(zoom, minZoom, maxZoom),
  });

  // References for gesture handling
  const containerRef = useRef<View>(null);
  const lastPinchScale = useRef(1);
  const lastPanDelta = useRef({ x: 0, y: 0 });
  const isGesturing = useRef(false);

  // Throttled region change callback
  const throttledRegionChange = useCallback(
    (() => {
      let timeout: NodeJS.Timeout | null = null;
      return (region: MapRegion) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          onRegionChange?.(region);
        }, 16); // ~60fps
      };
    })(),
    [onRegionChange]
  );

  // Debounced region change callback  
  const debouncedRegionChange = useCallback(
    (() => {
      let timeout: NodeJS.Timeout | null = null;
      return (region: MapRegion) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          onRegionChange?.(region);
        }, 200);
      };
    })(),
    [onRegionChange]
  );

  // Calculate new region based on pan and zoom gestures
  const calculateNewRegion = useCallback((deltaX: number, deltaY: number, scale: number): MapRegion => {
    const { latitude, longitude, zoom: currentZoom } = currentRegion;
    
    // Calculate new zoom
    const newZoom = clamp(currentZoom + Math.log2(scale), minZoom, maxZoom);
    
    // Calculate meters per pixel for pan calculation
    const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, newZoom);
    
    // Convert pixel delta to coordinate delta
    const deltaLat = (deltaY * metersPerPixel) / 111320;
    const deltaLon = (deltaX * metersPerPixel) / (111320 * Math.cos(latitude * Math.PI / 180));
    
    return {
      latitude: clamp(latitude - deltaLat, -85, 85),
      longitude: ((longitude - deltaLon + 540) % 360) - 180,
      zoom: newZoom,
    };
  }, [currentRegion, minZoom, maxZoom]);

  // Convert geographic coordinates to screen coordinates
  const coordinateToScreen = useCallback((coordinate: [number, number]): { x: number; y: number } => {
    const [lon, lat] = coordinate;
    const { latitude, longitude, zoom: currentZoom } = currentRegion;
    
    // Calculate tile coordinates for center and point
    const centerTile = latLonToTile(latitude, longitude, currentZoom);
    const pointTile = latLonToTile(lat, lon, currentZoom);
    
    const deltaX = (pointTile.x - centerTile.x) * tileSize;
    const deltaY = (pointTile.y - centerTile.y) * tileSize;
    
    const screenX = screenWidth / 2 + deltaX;
    const screenY = screenHeight / 2 + deltaY;
    
    return { x: screenX, y: screenY };
  }, [currentRegion, tileSize]);

  // Convert screen coordinates to geographic coordinates
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

  // Pan gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        lastPanDelta.current = { x: 0, y: 0 };
        isGesturing.current = true;
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
        isGesturing.current = false;
        debouncedRegionChange(currentRegion);
      },
    })
  ).current;

  // Map press handler
  const handleMapPress = useCallback((event: any) => {
    if (onMapPress && !isGesturing.current) {
      const { locationX, locationY } = event.nativeEvent;
      const coordinate = screenToCoordinate({ x: locationX, y: locationY });
      onMapPress(coordinate);
    }
  }, [onMapPress, screenToCoordinate]);

  // Marker clustering
  const processedMarkers = useCallback(() => {
    if (!enableClustering || markers.length === 0) {
      return markers.map(marker => ({
        ...marker,
        screenPosition: coordinateToScreen(marker.coordinate),
      }));
    }

    // Simple clustering algorithm
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
      
      // Find nearby markers
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

  // Update region when props change
  useEffect(() => {
    const newRegion = {
      latitude: center[1],
      longitude: center[0],
      zoom: clamp(zoom, minZoom, maxZoom),
    };
    setCurrentRegion(newRegion);
  }, [center, zoom, minZoom, maxZoom]);

  // Notify when map is ready
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
      {/* Tile layer */}
      <TileLayer
        center={[currentRegion.longitude, currentRegion.latitude]}
        zoom={currentRegion.zoom}
        tileUrlTemplate={tileUrlTemplate}
        tileSize={tileSize}
        enableHighDPI={enableHighDPI}
        cacheSize={cacheSize}
        preloadRadius={1}
      />
      
      {/* Markers */}
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
