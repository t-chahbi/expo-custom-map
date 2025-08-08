// src/hooks/useFluidGestures.ts - Hook pour gestes ultra-fluides
import { useRef, useCallback, useMemo } from 'react';
import { PanResponder, Animated, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FluidGestureConfig {
  onPanUpdate?: (deltaX: number, deltaY: number) => void;
  onPanEnd?: (deltaX: number, deltaY: number, velocityX: number, velocityY: number) => void;
  onZoomUpdate?: (scale: number, centerX: number, centerY: number) => void;
  onZoomEnd?: (scale: number, centerX: number, centerY: number) => void;
  enableInertia?: boolean;
  inertiaDecelerationRate?: number;
  maxInertiaVelocity?: number;
  zoomSensitivity?: number;
  panThreshold?: number;
}

export const useFluidGestures = (config: FluidGestureConfig = {}) => {
  const {
    onPanUpdate,
    onPanEnd,
    onZoomUpdate,
    onZoomEnd,
    enableInertia = true,
    inertiaDecelerationRate = 0.95,
    maxInertiaVelocity = 3000,
    zoomSensitivity = 1,
    panThreshold = 2,
  } = config;

  // États des gestes
  const gestureState = useRef({
    isPanning: false,
    isZooming: false,
    initialDistance: 0,
    initialCenter: { x: 0, y: 0 },
    lastTimestamp: 0,
    velocityTracker: { x: 0, y: 0 },
  });

  // Animation refs
  const panAnim = useRef(new Animated.ValueXY()).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Calculer la distance entre deux touches
  const calculateDistance = useCallback((touches: any[]) => {
    if (touches.length < 2) return 0;
    
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculer le centre entre deux touches
  const calculateCenter = useCallback((touches: any[]) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    
    return {
      x: (touches[0].pageX + touches[1].pageX) / 2,
      y: (touches[0].pageY + touches[1].pageY) / 2,
    };
  }, []);

  // Mettre à jour le tracker de vélocité
  const updateVelocityTracker = useCallback((dx: number, dy: number) => {
    const now = Date.now();
    const timeDelta = now - gestureState.current.lastTimestamp;
    
    if (timeDelta > 0) {
      gestureState.current.velocityTracker = {
        x: dx / timeDelta,
        y: dy / timeDelta,
      };
    }
    
    gestureState.current.lastTimestamp = now;
  }, []);

  // Appliquer l'inertie après le geste
  const applyInertia = useCallback((velocityX: number, velocityY: number) => {
    if (!enableInertia) return;
    
    const velocity = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    
    if (velocity > 50 && velocity < maxInertiaVelocity) {
      const duration = Math.min(velocity * 2, 1500);
      
      Animated.decay(panAnim, {
        velocity: { x: velocityX * 1000, y: velocityY * 1000 },
        deceleration: inertiaDecelerationRate,
        useNativeDriver: false,
      }).start();
    }
  }, [enableInertia, maxInertiaVelocity, inertiaDecelerationRate, panAnim]);

  // PanResponder optimisé
  const panResponder = useMemo(() => 
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > panThreshold || Math.abs(dy) > panThreshold;
      },
      
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        // Arrêter toute animation en cours
        panAnim.stopAnimation();
        scaleAnim.stopAnimation();
        
        // Initialiser l'état du geste
        const touches = evt.nativeEvent.touches;
        gestureState.current = {
          isPanning: touches.length === 1,
          isZooming: touches.length === 2,
          initialDistance: calculateDistance(touches),
          initialCenter: calculateCenter(touches),
          lastTimestamp: Date.now(),
          velocityTracker: { x: 0, y: 0 },
        };
      },

      onPanResponderMove: (evt, gestureStateParam) => {
        const touches = evt.nativeEvent.touches;
        const { dx, dy, numberActiveTouches } = gestureStateParam;
        
        // Mettre à jour le tracker de vélocité
        updateVelocityTracker(dx, dy);
        
        if (numberActiveTouches === 1 && gestureState.current.isPanning) {
          // Geste de pan
          onPanUpdate?.(dx, dy);
          
        } else if (numberActiveTouches === 2 && gestureState.current.isZooming) {
          // Geste de zoom
          const currentDistance = calculateDistance(touches);
          const currentCenter = calculateCenter(touches);
          
          if (gestureState.current.initialDistance > 0) {
            const scale = (currentDistance / gestureState.current.initialDistance) * zoomSensitivity;
            onZoomUpdate?.(scale, currentCenter.x, currentCenter.y);
          }
        }
      },

      onPanResponderRelease: (evt, gestureStateParam) => {
        const { dx, dy, numberActiveTouches } = gestureStateParam;
        const { velocityTracker } = gestureState.current;
        
        if (gestureState.current.isPanning && numberActiveTouches === 0) {
          onPanEnd?.(dx, dy, velocityTracker.x, velocityTracker.y);
          
          // Appliquer l'inertie
          applyInertia(velocityTracker.x, velocityTracker.y);
          
        } else if (gestureState.current.isZooming) {
          const touches = evt.nativeEvent.touches;
          const currentDistance = calculateDistance(touches);
          const currentCenter = calculateCenter(touches);
          
          if (gestureState.current.initialDistance > 0) {
            const scale = (currentDistance / gestureState.current.initialDistance) * zoomSensitivity;
            onZoomEnd?.(scale, currentCenter.x, currentCenter.y);
          }
        }
        
        // Réinitialiser l'état
        gestureState.current.isPanning = false;
        gestureState.current.isZooming = false;
      },

      onPanResponderTerminate: () => {
        // Nettoyer en cas d'interruption
        gestureState.current.isPanning = false;
        gestureState.current.isZooming = false;
      },
    }), 
    [
      onPanUpdate, onPanEnd, onZoomUpdate, onZoomEnd,
      calculateDistance, calculateCenter, updateVelocityTracker,
      applyInertia, zoomSensitivity, panThreshold, panAnim, scaleAnim
    ]
  );

  return {
    panResponder,
    panAnim,
    scaleAnim,
    isGestureActive: gestureState.current.isPanning || gestureState.current.isZooming,
  };
};
