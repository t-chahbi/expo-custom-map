// src/CustomMapView.tsx - Version ultra-fluide optimisée pour performance
import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState, Animated } from 'react-native';
import { MapViewProps, MapRegion } from './types';
import TileLayer from './components/TileLayer';
import MarkerComponent from './components/MarkerComponent';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Utility functions optimisées
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

// Constantes de performance
const PERFORMANCE_CONFIG = {
  THROTTLE_MS: 16, // ~60fps
  DEBOUNCE_MS: 100,
  ANIMATION_DURATION: 300,
  MAX_GESTURE_VELOCITY: 5000,
  MIN_ZOOM_GESTURE_DISTANCE: 10,
} as const;

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
  // Animation values pour la fluidité
  const panAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Map region state avec validation
  const [currentRegion, setCurrentRegion] = useState<MapRegion>(() => ({
    latitude: center[1],
    longitude: center[0],
    zoom: clamp(zoom, minZoom, maxZoom),
  }));

  // États pour la performance
  const [isAnimating, setIsAnimating] = useState(false);
  const [gestureState, setGestureState] = useState<'none' | 'pan' | 'pinch'>('none');
  
  // Refs pour les calculs optimisés
  const containerRef = useRef<View>(null);
  const lastUpdateTime = useRef(0);
  const gestureStartRegion = useRef<MapRegion>(currentRegion);
  const velocityTracker = useRef({ x: 0, y: 0, timestamp: 0 });
  
  // Cache optimisé pour les calculs
  const calculationCache = useMemo(() => new Map(), []);
  
  // Fonction de mise à jour throttlée ultra-optimisée
  const updateRegionThrottled = useCallback((newRegion: MapRegion, isUserInteraction = false) => {
    const now = performance.now();
    
    if (now - lastUpdateTime.current < PERFORMANCE_CONFIG.THROTTLE_MS && !isUserInteraction) {
      return;
    }
    
    lastUpdateTime.current = now;
    
    requestAnimationFrame(() => {
      setCurrentRegion(prevRegion => {
        // Éviter les mises à jour inutiles
        if (
          Math.abs(prevRegion.latitude - newRegion.latitude) < 0.00001 &&
          Math.abs(prevRegion.longitude - newRegion.longitude) < 0.00001 &&
          Math.abs(prevRegion.zoom - newRegion.zoom) < 0.01
        ) {
          return prevRegion;
        }
        
        onRegionChange?.(newRegion);
        return newRegion;
      });
    });
  }, [onRegionChange]);

  // Calcul de position des marqueurs optimisé avec cache
  const calculateMarkerPosition = useCallback((markerCoord: [number, number]) => {
    const cacheKey = `${markerCoord[0]}-${markerCoord[1]}-${currentRegion.latitude}-${currentRegion.longitude}-${currentRegion.zoom}`;
    
    if (calculationCache.has(cacheKey)) {
      return calculationCache.get(cacheKey);
    }
    
    const markerLat = markerCoord[1];
    const markerLon = markerCoord[0];
    
    const centerTile = latLonToTile(currentRegion.latitude, currentRegion.longitude, currentRegion.zoom);
    const markerTile = latLonToTile(markerLat, markerLon, currentRegion.zoom);
    
    const deltaX = (markerTile.x - centerTile.x) * tileSize;
    const deltaY = (markerTile.y - centerTile.y) * tileSize;
    
    const position = {
      x: screenWidth / 2 + deltaX,
      y: screenHeight / 2 + deltaY,
    };
    
    // Cache avec limitation de taille
    if (calculationCache.size > 1000) {
      calculationCache.clear();
    }
    calculationCache.set(cacheKey, position);
    
    return position;
  }, [currentRegion, tileSize, calculationCache]);

  // Gestionnaire de pincement pour zoom fluide
  const handlePinchGesture = useCallback((scale: number, centerX: number, centerY: number) => {
    const newZoom = clamp(
      gestureStartRegion.current.zoom + Math.log2(scale),
      minZoom,
      maxZoom
    );
    
    // Calculer le nouveau centre basé sur le point de pincement
    const deltaX = (centerX - screenWidth / 2) / tileSize;
    const deltaY = (centerY - screenHeight / 2) / tileSize;
    
    const zoomDelta = newZoom - gestureStartRegion.current.zoom;
    const scaleFactor = Math.pow(2, zoomDelta);
    
    const adjustedDeltaX = deltaX * (1 - 1 / scaleFactor);
    const adjustedDeltaY = deltaY * (1 - 1 / scaleFactor);
    
    const centerTile = latLonToTile(
      gestureStartRegion.current.latitude,
      gestureStartRegion.current.longitude,
      gestureStartRegion.current.zoom
    );
    
    const newCenterTile = {
      x: centerTile.x + adjustedDeltaX,
      y: centerTile.y + adjustedDeltaY,
    };
    
    const newCenter = tileToLatLon(newCenterTile.x, newCenterTile.y, gestureStartRegion.current.zoom);
    
    const newRegion = {
      latitude: newCenter.lat,
      longitude: newCenter.lon,
      zoom: newZoom,
    };
    
    updateRegionThrottled(newRegion, true);
  }, [minZoom, maxZoom, tileSize, updateRegionThrottled]);

  // Pan responder ultra-optimisé
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        setGestureState('pan');
        gestureStartRegion.current = { ...currentRegion };
        velocityTracker.current = { x: 0, y: 0, timestamp: Date.now() };
        
        // Arrêter toute animation en cours
        panAnim.stopAnimation();
        scaleAnim.stopAnimation();
        setIsAnimating(false);
      },

      onPanResponderMove: (evt, gestureState) => {
        const now = Date.now();
        
        // Mettre à jour le tracker de vélocité
        if (now - velocityTracker.current.timestamp > 16) {
          velocityTracker.current = {
            x: gestureState.vx,
            y: gestureState.vy,
            timestamp: now,
          };
        }
        
        // Pan en temps réel avec throttling
        if (gestureState.numberActiveTouches === 1) {
          const deltaX = -gestureState.dx / tileSize;
          const deltaY = -gestureState.dy / tileSize;
          
          const centerTile = latLonToTile(
            gestureStartRegion.current.latitude,
            gestureStartRegion.current.longitude,
            gestureStartRegion.current.zoom
          );
          
          const newCenterTile = {
            x: centerTile.x + deltaX,
            y: centerTile.y + deltaY,
          };
          
          const newCenter = tileToLatLon(newCenterTile.x, newCenterTile.y, gestureStartRegion.current.zoom);
          
          const newRegion = {
            latitude: newCenter.lat,
            longitude: newCenter.lon,
            zoom: gestureStartRegion.current.zoom,
          };
          
          updateRegionThrottled(newRegion, true);
        }
        // Pinch pour zoom
        else if (gestureState.numberActiveTouches === 2) {
          setGestureState('pinch');
          
          // Calculer l'échelle basée sur la distance entre les doigts
          const touches = evt.nativeEvent.touches;
          if (touches.length === 2) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const centerX = (touches[0].pageX + touches[1].pageX) / 2;
            const centerY = (touches[0].pageY + touches[1].pageY) / 2;
            
            // Utiliser la distance comme base pour l'échelle
            const scale = distance / 200; // Normaliser
            handlePinchGesture(scale, centerX, centerY);
          }
        }
      },

      onPanResponderRelease: (evt, gestureState) => {
        setGestureState('none');
        
        // Inertie pour le pan
        if (gestureState.numberActiveTouches === 0) {
          const velocity = Math.sqrt(
            velocityTracker.current.x ** 2 + velocityTracker.current.y ** 2
          );
          
          if (velocity > 100 && velocity < PERFORMANCE_CONFIG.MAX_GESTURE_VELOCITY) {
            setIsAnimating(true);
            
            const decelerationRate = 0.95;
            const animationDuration = Math.min(velocity * 2, 1000);
            
            const finalX = gestureState.dx + (velocityTracker.current.x * animationDuration * decelerationRate);
            const finalY = gestureState.dy + (velocityTracker.current.y * animationDuration * decelerationRate);
            
            Animated.timing(panAnim, {
              toValue: { x: finalX, y: finalY },
              duration: animationDuration,
              useNativeDriver: false,
            }).start(() => {
              setIsAnimating(false);
              panAnim.setValue({ x: 0, y: 0 });
            });
          }
        }
        
        calculationCache.clear(); // Nettoyer le cache après interaction
      },
    })
  ).current;

  // Gestionnaire de pression optimisé
  const handleMapPress = useCallback((evt: GestureResponderEvent) => {
    if (gestureState !== 'none' || isAnimating) return;
    
    const { locationX, locationY } = evt.nativeEvent;
    
    const deltaX = (locationX - screenWidth / 2) / tileSize;
    const deltaY = (locationY - screenHeight / 2) / tileSize;
    
    const centerTile = latLonToTile(currentRegion.latitude, currentRegion.longitude, currentRegion.zoom);
    const targetTile = {
      x: centerTile.x + deltaX,
      y: centerTile.y + deltaY,
    };
    
    const targetLatLon = tileToLatLon(targetTile.x, targetTile.y, currentRegion.zoom);
    const coordinates: [number, number] = [targetLatLon.lon, targetLatLon.lat];
    
    onMapPress?.(coordinates);
  }, [currentRegion, tileSize, onMapPress, gestureState, isAnimating]);

  // Mise à jour des props
  useEffect(() => {
    const newRegion = {
      latitude: center[1],
      longitude: center[0],
      zoom: clamp(zoom, minZoom, maxZoom),
    };
    
    if (
      Math.abs(currentRegion.latitude - newRegion.latitude) > 0.00001 ||
      Math.abs(currentRegion.longitude - newRegion.longitude) > 0.00001 ||
      Math.abs(currentRegion.zoom - newRegion.zoom) > 0.01
    ) {
      updateRegionThrottled(newRegion);
    }
  }, [center, zoom, minZoom, maxZoom, currentRegion, updateRegionThrottled]);

  // Notification map ready optimisée
  useEffect(() => {
    const timer = setTimeout(() => {
      onMapReady?.();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [onMapReady]);

  // Calcul des marqueurs visibles optimisé
  const visibleMarkers = useMemo(() => {
    if (!markers.length) return [];
    
    return markers.map((marker, index) => {
      const position = calculateMarkerPosition(marker.coordinate);
      const isVisible = 
        position.x >= -100 && 
        position.x <= screenWidth + 100 && 
        position.y >= -100 && 
        position.y <= screenHeight + 100;
      
      return {
        ...marker,
        markerId: marker.id || `marker-${index}`,
        screenX: position.x,
        screenY: position.y,
        isVisible,
      };
    }).filter(marker => marker.isVisible);
  }, [markers, calculateMarkerPosition]);

  return (
    <View 
      ref={containerRef}
      style={[styles.container, style]} 
      {...panResponder.panHandlers}
      onStartShouldSetResponder={() => true}
      onResponderGrant={handleMapPress}
    >
      {/* Tile Layer avec animation */}
      <Animated.View style={[StyleSheet.absoluteFill]}>
        <TileLayer
          center={[currentRegion.longitude, currentRegion.latitude]}
          zoom={currentRegion.zoom}
          tileUrlTemplate={tileUrlTemplate}
          tileSize={tileSize}
        />
      </Animated.View>
      
      {/* Markers optimisés */}
      {visibleMarkers.map((marker) => (
        <MarkerComponent
          key={marker.markerId}
          {...marker}
          screenX={marker.screenX}
          screenY={marker.screenY}
          isVisible={marker.isVisible}
        />
      ))}
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
